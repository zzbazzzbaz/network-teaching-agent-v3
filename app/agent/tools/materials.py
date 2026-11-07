import asyncio
import json
import logging
import posixpath
import re
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import frontmatter
from agentscope.message import TextBlock, ToolResultState
from agentscope.permission import (
    PermissionBehavior,
    PermissionContext,
    PermissionDecision,
)
from agentscope.tool import ToolBase, ToolChunk

from app.agent.tools.schemas.materials import (
    MaterialsGrepInput,
    MaterialsLsInput,
    MaterialsReadInput,
)
from app.shared.config import get_settings

logger = logging.getLogger(__name__)

READABLE_SUFFIXES = {".md", ".txt", ".json"}
SEARCHABLE_SUFFIXES = (".md", ".txt")
MAX_READ_CHARS = 10_000
MAX_FILE_BYTES = 512 * 1024
MAX_LS_ENTRIES = 200
MAX_GREP_TERMS = 8
SNIPPET_CHARS = 160
GREP_TIME_BUDGET = 0.3
INDEX_TTL_SECONDS = 30.0
CONTENT_CACHE_BYTES = 50 * 1024 * 1024

_IMAGE_PATTERN = re.compile(r"!\[([^\]]*)\]\([^)]*\)")
_BLANK_LINES_PATTERN = re.compile(r"\n{3,}")
_QUERY_SEPARATOR = re.compile(r"[\s,,、]+")
_NATURAL_PATTERN = re.compile(r"(\d+)")

_LS_DESCRIPTION = (
    "列出只读资料库的目录, 像 ls。根目录是 `/`, 每本书是一个目录。"
    "depth 控制显示层数(1-3)。只用于浏览目录, 不读取文件内容。"
)

_READ_DESCRIPTION = (
    "读取资料库中的文本文件, 像 cat。path 以 `/` 开头, 例如 "
    "`/computer-networks-8e/textbook/05-运输层/5.5-TCP报文段的首部格式.md`。"
    "只支持 .md/.txt/.json; 默认 120 行, 超出时用 offset 续读。"
)

_GREP_DESCRIPTION = (
    "在资料库中按关键词搜索, 像 grep。多个关键词用空格分隔; "
    "path 可以限定到某本书或某个目录。返回文件、页码头、行号和上下文。"
)


class _MaterialsError(Exception):
    pass


@dataclass(slots=True)
class _Entry:
    path: str
    name: str
    is_dir: bool
    size: int = 0
    mtime_ns: int = 0
    title: str = ""
    section: str = ""
    pages: tuple[int, int] | None = None
    citation: str = ""
    book_slug: str = ""
    children: int = 0


class _Library:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.built_at = 0.0
        self.entries: dict[str, _Entry] = {
            "/": _Entry(path="/", name="/", is_dir=True),
        }
        self.child_paths: dict[str, list[str]] = {"/": []}
        self.books: dict[str, dict[str, Any]] = {}
        self.contents: dict[str, tuple[int, dict[str, Any], str]] = {}
        self.content_bytes = 0


_LIBRARIES: dict[Path, _Library] = {}
_BUILD_LOCKS: dict[Path, threading.Lock] = {}
_INDEX_LOCK = threading.Lock()
_CONTENT_LOCK = threading.Lock()


def materials_root() -> Path:
    return get_settings().materials_dir.resolve()


def _is_fresh(library: _Library) -> bool:
    return time.monotonic() - library.built_at <= INDEX_TTL_SECONDS


async def _get_library(resolved: Path) -> _Library:
    with _INDEX_LOCK:
        library = _LIBRARIES.get(resolved)
        if library is not None and _is_fresh(library):
            return library
        build_lock = _BUILD_LOCKS.setdefault(resolved, threading.Lock())

    def build() -> _Library:
        with build_lock:
            with _INDEX_LOCK:
                cached = _LIBRARIES.get(resolved)
                if cached is not None and _is_fresh(cached):
                    return cached
            rebuilt = _build_library(resolved)
            with _INDEX_LOCK:
                previous = _LIBRARIES.get(resolved)
                if previous is not None:
                    with _CONTENT_LOCK:
                        rebuilt.contents = previous.contents
                        rebuilt.content_bytes = previous.content_bytes
                _LIBRARIES[resolved] = rebuilt
            return rebuilt

    return await asyncio.to_thread(build)


def _build_library(root: Path) -> _Library:
    library = _Library(root)
    if not root.is_dir():
        library.built_at = time.monotonic()
        return library

    for path in sorted(root.rglob("*")):
        try:
            relative = path.relative_to(root)
        except ValueError:
            continue
        if any(part.startswith(".") or part == "__pycache__" for part in relative.parts):
            continue
        if path.is_symlink() or path.is_dir():
            continue
        if not path.is_file() or path.suffix.lower() not in READABLE_SUFFIXES:
            continue
        try:
            if not path.resolve().is_relative_to(root):
                continue
            stat = path.stat()
        except OSError:
            continue

        virtual = "/" + relative.as_posix()
        _ensure_dir_path(library, posixpath.dirname(virtual) or "/")
        metadata = _read_metadata(path)
        book_slug = relative.parts[0] if len(relative.parts) > 1 else ""
        library.entries[virtual] = _Entry(
            path=virtual,
            name=path.name,
            is_dir=False,
            size=stat.st_size,
            mtime_ns=stat.st_mtime_ns,
            title=str(metadata.get("title") or ""),
            section=str(metadata.get("section") or ""),
            pages=_parse_pages(metadata.get("book_pages") or metadata.get("pages")),
            citation=str(metadata.get("citation") or ""),
            book_slug=book_slug,
        )
        _add_child(library, virtual)
        if path.name == "book.json" and len(relative.parts) == 2:
            book = _read_book_json(path)
            if book is not None:
                library.books[book_slug] = book

    for virtual, children in library.child_paths.items():
        entry = library.entries.get(virtual)
        if entry is not None:
            entry.children = len(children)
    library.built_at = time.monotonic()
    return library


def _add_child(library: _Library, virtual: str) -> None:
    parent = posixpath.dirname(virtual) or "/"
    library.child_paths.setdefault(parent, []).append(virtual)
    library.child_paths.setdefault(virtual, [])


def _ensure_dir_path(library: _Library, virtual: str) -> None:
    if virtual == "/" or virtual in library.entries:
        return
    parent = posixpath.dirname(virtual) or "/"
    _ensure_dir_path(library, parent)
    library.entries[virtual] = _Entry(
        path=virtual,
        name=posixpath.basename(virtual),
        is_dir=True,
    )
    _add_child(library, virtual)


def _read_metadata(path: Path) -> dict[str, Any]:
    if path.suffix.lower() != ".md":
        return {}
    try:
        raw = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return {}
    try:
        post = frontmatter.loads(raw)
    except Exception:
        return {}
    return dict(post.metadata or {})


def _read_book_json(path: Path) -> dict[str, Any] | None:
    try:
        data = json.loads(path.read_text(encoding="utf-8", errors="replace"))
    except (OSError, json.JSONDecodeError):
        return None
    return data if isinstance(data, dict) else None


def _parse_pages(value: Any) -> tuple[int, int] | None:
    if isinstance(value, int):
        return value, value
    if isinstance(value, (list, tuple)) and len(value) == 2:
        try:
            return int(value[0]), int(value[1])
        except (TypeError, ValueError):
            return None
    return None


def _normalize_path(path: str) -> str:
    value = (path or "/").strip().replace("\\", "/")
    if "\x00" in value:
        raise _MaterialsError("路径包含非法字符。")
    if not value.startswith("/"):
        value = "/" + value
    parts = [part for part in value.split("/") if part not in ("", ".")]
    if any(part == ".." for part in parts):
        raise _MaterialsError("路径不能包含 `..`。")
    return "/" + "/".join(parts)


def _find_entry(library: _Library, path: str) -> _Entry:
    normalized = _normalize_path(path)
    entry = library.entries.get(normalized)
    if entry is not None:
        return entry

    needle = normalized.lstrip("/")
    candidates = [
        candidate
        for candidate_path, candidate in library.entries.items()
        if candidate_path != "/" and candidate_path.endswith("/" + needle)
    ]
    if len(candidates) == 1:
        return candidates[0]
    if candidates:
        listing = "\n".join(f"- {item.path}" for item in candidates[:5])
        raise _MaterialsError(f"路径不唯一: {normalized}\n候选:\n{listing}")
    raise _MaterialsError(f"路径不存在: {normalized}\n用 materials_ls 查看目录。")


def _book_title(library: _Library, slug: str) -> str:
    if not slug:
        return ""
    title = (library.books.get(slug) or {}).get("title")
    return str(title) if title else slug


def _chapter_label(section: str) -> str:
    if not section:
        return ""
    if section[0].isdigit():
        return f"第{section.split('-')[0].split('.')[0]}章"
    return f"附录{section.split('-')[0]}"


def _section_label(section: str, title: str) -> str:
    chapter = _chapter_label(section)
    if section.endswith("-summary") or section.endswith("-exercises"):
        return " ".join(part for part in (chapter, title) if part)
    return " ".join(part for part in (chapter, section, title) if part)


def _pages_label(pages: tuple[int, int]) -> str:
    start, end = pages
    if start == end:
        return f"第{start}页"
    return f"第{start}-{end}页"


def _header(library: _Library, entry: _Entry, metadata: dict[str, Any]) -> str:
    citation = str(metadata.get("citation") or entry.citation or "").strip()
    if citation:
        return f"【{citation}】"

    section = str(metadata.get("section") or entry.section or "")
    title = str(metadata.get("title") or entry.title or "")
    pages = _parse_pages(metadata.get("book_pages") or metadata.get("pages")) or entry.pages
    label = _section_label(section, title)
    if not label and not pages:
        return ""

    parts = [_book_title(library, entry.book_slug), label]
    if pages:
        parts.append(_pages_label(pages))
    return f"【{' | '.join(part for part in parts if part)}】"


def _clean_markdown(text: str) -> str:
    cleaned = _IMAGE_PATTERN.sub(r"\1", text)
    cleaned = _BLANK_LINES_PATTERN.sub("\n\n", cleaned)
    return cleaned.strip()


def _load_document(library: _Library, entry: _Entry) -> tuple[dict[str, Any], str]:
    file_path = library.root / entry.path.lstrip("/")
    stat = file_path.stat()
    with _CONTENT_LOCK:
        cached = library.contents.get(entry.path)
        if cached is not None and cached[0] == stat.st_mtime_ns:
            return cached[1], cached[2]

    raw = file_path.read_text(encoding="utf-8", errors="replace")
    if file_path.suffix.lower() == ".json":
        metadata: dict[str, Any] = {}
        body = raw.strip()
    else:
        try:
            post = frontmatter.loads(raw)
        except Exception:
            metadata = {}
            body = raw
        else:
            metadata = dict(post.metadata or {})
            body = post.content
        body = _clean_markdown(body)

    with _CONTENT_LOCK:
        previous = library.contents.get(entry.path)
        if previous is not None:
            library.content_bytes -= len(previous[2])
        library.contents[entry.path] = (stat.st_mtime_ns, metadata, body)
        library.content_bytes += len(body)
        if library.content_bytes > CONTENT_CACHE_BYTES:
            library.contents.clear()
            library.content_bytes = 0
    return metadata, body


def _natural_key(name: str) -> tuple[tuple[int, Any], ...]:
    parts = _NATURAL_PATTERN.split(name.casefold())
    return tuple(
        (0, int(part)) if part.isdigit() else (1, part) for part in parts if part
    )


def _sort_key(library: _Library, path: str) -> tuple[bool, tuple[tuple[int, Any], ...]]:
    entry = library.entries[path]
    return not entry.is_dir, _natural_key(entry.name)


def _file_label(library: _Library, entry: _Entry) -> str:
    if entry.name == "book.json":
        title = _book_title(library, entry.book_slug)
        return f"{entry.name}  {title}" if title else entry.name
    if entry.name == "00-toc.md":
        return f"{entry.name}  目录"
    label = _section_label(entry.section, entry.title)
    pages = _pages_label(entry.pages) if entry.pages else ""
    suffix = "  ".join(part for part in (label, pages) if part)
    return f"{entry.name}  {suffix}" if suffix else entry.name


def _walk(
    library: _Library,
    parent: str,
    level: int,
    max_depth: int,
    lines: list[str],
) -> None:
    for child_path in sorted(
        library.child_paths.get(parent, []),
        key=lambda item: _sort_key(library, item),
    ):
        if len(lines) >= MAX_LS_ENTRIES:
            return
        child = library.entries[child_path]
        indent = "  " * level
        if child.is_dir:
            line = f"{indent}{child.name}/  {child.children} 个条目"
            if parent == "/":
                title = _book_title(library, child.name)
                if title and title != child.name:
                    line = f"{line}  {title}"
            lines.append(line)
            if level < max_depth:
                _walk(library, child.path, level + 1, max_depth, lines)
        else:
            lines.append(f"{indent}{_file_label(library, child)}")


def _ls(library: _Library, path: str, depth: int) -> str:
    entry = _find_entry(library, path)
    if not entry.is_dir:
        raise _MaterialsError(f"`{entry.path}` 是文件, 请用 materials_read 读取。")
    if entry.path == "/" and not library.child_paths.get("/"):
        return "资料库为空。"

    if entry.path == "/":
        lines = ["资料库 /"]
    else:
        title = ""
        if entry.path.count("/") == 1:
            slug = entry.path.strip("/")
            title = _book_title(library, slug)
            if title == slug:
                title = ""
        lines = [f"{entry.path}  {title}".rstrip()]

    _walk(library, entry.path, 1, depth, lines)
    if len(lines) >= MAX_LS_ENTRIES:
        lines = lines[:MAX_LS_ENTRIES]
        lines.append(f"[已截断: 超过 {MAX_LS_ENTRIES} 行, 请缩小 path 或 depth]")
    return "\n".join(lines)


def _read(library: _Library, path: str, offset: int, limit: int) -> str:
    entry = _find_entry(library, path)
    if entry.is_dir:
        raise _MaterialsError(f"`{entry.path}` 是目录, 请用 materials_ls 浏览。")

    file_path = library.root / entry.path.lstrip("/")
    try:
        size = file_path.stat().st_size
        metadata, body = _load_document(library, entry)
    except OSError as exc:
        raise _MaterialsError(f"文件无法读取: {entry.path}") from exc
    if size > MAX_FILE_BYTES:
        raise _MaterialsError(f"文件过大({size} 字节), 不提供读取。")

    lines = body.splitlines()
    total = len(lines)
    header = _header(library, entry, metadata)
    if total == 0:
        return "\n".join(part for part in (header, "(空文件)") if part)
    if offset > total:
        raise _MaterialsError(f"offset 超出范围: 共 {total} 行。")

    end = min(offset - 1 + limit, total)
    selected: list[str] = []
    chars = 0
    for index in range(offset - 1, end):
        line = lines[index]
        if chars + len(line) + 1 > MAX_READ_CHARS and selected:
            end = index
            break
        if len(line) > MAX_READ_CHARS:
            line = line[:MAX_READ_CHARS] + "…"
        selected.append(line)
        chars += len(line) + 1

    output = [header or entry.path, f"(第 {offset}-{end} 行, 共 {total} 行)", ""]
    output.extend(selected)
    if end < total:
        output.append(f"[已截断: 用 offset={end + 1} 继续, 共 {total} 行]")
    return "\n".join(output)


def _query_terms(query: str) -> list[str]:
    parts = _QUERY_SEPARATOR.split(query.strip())
    terms = [part.casefold() for part in parts if part]
    deduped = list(dict.fromkeys(terms))[:MAX_GREP_TERMS]
    longer = [term for term in deduped if len(term) > 1]
    return longer or deduped


def _score(metadata: dict[str, Any], body: str, terms: list[str]) -> int:
    title = str(metadata.get("title") or "").casefold()
    section = str(metadata.get("section") or "").casefold()
    folded = body.casefold()
    title_hits = sum(1 for term in terms if term in title)
    section_hits = sum(1 for term in terms if term in section)
    body_hits = sum(min(folded.count(term), 10) for term in terms)
    return title_hits * 50 + section_hits * 50 + body_hits


def _snippets(body: str, terms: list[str]) -> list[tuple[int, str]]:
    results: list[tuple[int, str]] = []
    for number, line in enumerate(body.splitlines(), start=1):
        folded = line.casefold()
        positions = [folded.find(term) for term in terms if term in folded]
        if not positions:
            continue
        text = line.strip()
        if len(line) > SNIPPET_CHARS:
            start = max(0, min(positions) - SNIPPET_CHARS // 3)
            end = start + SNIPPET_CHARS
            text = line[start:end].strip()
            if start > 0:
                text = "…" + text
            if end < len(line):
                text = text + "…"
        results.append((number, text))
        if len(results) >= 2:
            break
    return results


def _grep(library: _Library, query: str, path: str, limit: int) -> str:
    terms = _query_terms(query)
    if not terms:
        raise _MaterialsError("搜索词不能为空。")

    scope = _find_entry(library, path)
    if scope.is_dir:
        prefix = scope.path.rstrip("/") + "/"
        files = [
            entry
            for entry_path, entry in library.entries.items()
            if not entry.is_dir
            and entry_path.startswith(prefix)
            and entry.name.lower().endswith(SEARCHABLE_SUFFIXES)
        ]
    else:
        if not scope.name.lower().endswith(SEARCHABLE_SUFFIXES):
            raise _MaterialsError(f"`{scope.path}` 不是可搜索的文本文件。")
        files = [scope]

    deadline = time.monotonic() + GREP_TIME_BUDGET
    hits: list[tuple[int, _Entry, dict[str, Any], list[tuple[int, str]]]] = []
    truncated = False

    for entry in sorted(files, key=lambda item: item.path):
        try:
            metadata, body = _load_document(library, entry)
        except OSError:
            continue
        score = _score(metadata, body, terms)
        if score <= 0:
            continue
        hits.append((score, entry, metadata, _snippets(body, terms)))
        if time.monotonic() > deadline:
            truncated = True
            break

    hits.sort(key=lambda item: (-item[0], item[1].path))
    selected = hits[:limit]
    if not selected:
        return "未找到匹配内容。可以换同义词、英文缩写或小节号再试。"

    lines: list[str] = []
    for index, (_, entry, metadata, snippets) in enumerate(selected, start=1):
        lines.append(f"[{index}] {entry.path}")
        header = _header(library, entry, metadata)
        if header:
            lines.append(header)
        if snippets:
            lines.extend(f"  第 {number} 行: {text}" for number, text in snippets)
        else:
            label = _section_label(entry.section, entry.title)
            lines.append(f"  标题命中: {label}" if label else "  标题命中")
    if truncated:
        lines.append("[已返回部分结果: 可缩小 path 或换更具体的关键词]")
    return "\n".join(lines)


class _MaterialsTool(ToolBase):
    is_read_only: bool = True
    is_concurrency_safe: bool = True

    def __init__(self, root: Path | None = None) -> None:
        super().__init__()
        self._root = root.resolve() if root is not None else None

    async def check_permissions(
        self,
        tool_input: dict[str, Any],
        context: PermissionContext,
    ) -> PermissionDecision:
        del tool_input, context
        return PermissionDecision(
            behavior=PermissionBehavior.ALLOW,
            message="资料库只读, 自动放行。",
        )

    def _root_path(self) -> Path:
        return self._root if self._root is not None else materials_root()


class MaterialsLs(_MaterialsTool):
    name: str = "materials_ls"
    description: str = _LS_DESCRIPTION
    input_schema: dict[str, Any] = MaterialsLsInput.model_json_schema()

    async def call(self, **kwargs: Any) -> ToolChunk:
        data = MaterialsLsInput.model_validate(kwargs)
        try:
            library = await _get_library(self._root_path())
            text = await asyncio.to_thread(_ls, library, data.path, data.depth)
        except _MaterialsError as exc:
            return ToolChunk(
                content=[TextBlock(text=str(exc))],
                state=ToolResultState.ERROR,
            )
        except Exception:
            logger.exception("materials_ls failed")
            return ToolChunk(
                content=[TextBlock(text="资料库读取失败。")],
                state=ToolResultState.ERROR,
            )
        return ToolChunk(content=[TextBlock(text=text)])


class MaterialsRead(_MaterialsTool):
    name: str = "materials_read"
    description: str = _READ_DESCRIPTION
    input_schema: dict[str, Any] = MaterialsReadInput.model_json_schema()

    async def call(self, **kwargs: Any) -> ToolChunk:
        data = MaterialsReadInput.model_validate(kwargs)
        try:
            library = await _get_library(self._root_path())
            text = await asyncio.to_thread(
                _read,
                library,
                data.path,
                data.offset,
                data.limit,
            )
        except _MaterialsError as exc:
            return ToolChunk(
                content=[TextBlock(text=str(exc))],
                state=ToolResultState.ERROR,
            )
        except Exception:
            logger.exception("materials_read failed")
            return ToolChunk(
                content=[TextBlock(text="资料库读取失败。")],
                state=ToolResultState.ERROR,
            )
        return ToolChunk(content=[TextBlock(text=text)])


class MaterialsGrep(_MaterialsTool):
    name: str = "materials_grep"
    description: str = _GREP_DESCRIPTION
    input_schema: dict[str, Any] = MaterialsGrepInput.model_json_schema()

    async def call(self, **kwargs: Any) -> ToolChunk:
        data = MaterialsGrepInput.model_validate(kwargs)
        try:
            library = await _get_library(self._root_path())
            text = await asyncio.to_thread(
                _grep,
                library,
                data.query,
                data.path,
                data.limit,
            )
        except _MaterialsError as exc:
            return ToolChunk(
                content=[TextBlock(text=str(exc))],
                state=ToolResultState.ERROR,
            )
        except Exception:
            logger.exception("materials_grep failed")
            return ToolChunk(
                content=[TextBlock(text="资料库检索失败。")],
                state=ToolResultState.ERROR,
            )
        return ToolChunk(content=[TextBlock(text=text)])
