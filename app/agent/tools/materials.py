import asyncio
import re
from pathlib import Path
from typing import Any

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

READABLE_SUFFIXES = {".md", ".txt", ".json", ".html"}
SEARCHABLE_SUFFIXES = {".md", ".txt"}
_FRONTMATTER = re.compile(r"\A---\n.*?\n---\n", re.DOTALL)

_LS_DESCRIPTION = "列出资料库目录, 像 ls。根目录是 `/`。"
_READ_DESCRIPTION = (
    "读取资料库中的文本文件, 像 cat。path 以 `/` 开头, "
    "支持 .md/.txt/.json/.html, offset 和 limit 控制行范围。"
)
_GREP_DESCRIPTION = "在资料库中搜索字符串, 像 grep。一次搜一个关键词, 返回 `文件:行号: 内容`。"


def materials_root() -> Path:
    return get_settings().storage.materials_dir.resolve()


def _resolve(root: Path, path: str) -> Path:
    target = (root / (path or "/").lstrip("/")).resolve()
    if target != root and not target.is_relative_to(root):
        raise ValueError("路径越界")
    return target


def _read_text(path: Path) -> str:
    text = path.read_text(encoding="utf-8", errors="replace")
    return _FRONTMATTER.sub("", text, count=1).lstrip("\n")


def _virtual(root: Path, path: Path) -> str:
    return "/" + path.relative_to(root).as_posix()


def _ls(root: Path, path: str) -> str:
    target = _resolve(root, path)
    if not target.exists():
        raise ValueError(f"路径不存在: {path}")
    if not target.is_dir():
        raise ValueError(f"不是目录: {path}")
    names = [
        f"{child.name}/" if child.is_dir() else child.name
        for child in sorted(
            target.iterdir(),
            key=lambda item: (item.is_file(), item.name),
        )
        if not child.name.startswith(".")
    ]
    return "\n".join(names)


def _read(root: Path, path: str, offset: int, limit: int) -> str:
    target = _resolve(root, path)
    if not target.exists():
        raise ValueError(f"文件不存在: {path}")
    if not target.is_file():
        raise ValueError(f"不是文件: {path}")
    if target.suffix.lower() not in READABLE_SUFFIXES:
        raise ValueError(f"不支持的文件类型: {target.suffix}")
    lines = _read_text(target).splitlines()
    return "\n".join(lines[offset - 1 : offset - 1 + limit])


def _grep(root: Path, path: str, query: str, limit: int) -> str:
    target = _resolve(root, path)
    if not target.exists():
        raise ValueError(f"路径不存在: {path}")
    if target.is_file():
        if target.suffix.lower() not in SEARCHABLE_SUFFIXES:
            raise ValueError(f"不支持的文件类型: {target.suffix}")
        files = [target]
    else:
        files = [
            item
            for item in sorted(target.rglob("*"))
            if item.is_file()
            and not item.is_symlink()
            and item.suffix.lower() in SEARCHABLE_SUFFIXES
            and not any(part.startswith(".") for part in item.relative_to(root).parts)
        ]

    needle = query.casefold()
    results: list[str] = []
    for file in files:
        for number, line in enumerate(_read_text(file).splitlines(), start=1):
            if needle in line.casefold():
                results.append(f"{_virtual(root, file)}:{number}: {line.strip()}")
                if len(results) >= limit:
                    return "\n".join(results)
    return "\n".join(results) or "未找到"


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
            message="资料库只读",
        )

    def _library(self) -> Path:
        return self._root if self._root is not None else materials_root()

    def _error(self, message: str) -> ToolChunk:
        return ToolChunk(
            content=[TextBlock(text=message)],
            state=ToolResultState.ERROR,
        )


class MaterialsLs(_MaterialsTool):
    name: str = "materials_ls"
    description: str = _LS_DESCRIPTION
    input_schema: dict[str, Any] = MaterialsLsInput.model_json_schema()

    async def call(self, **kwargs: Any) -> ToolChunk:
        data = MaterialsLsInput.model_validate(kwargs)
        try:
            text = await asyncio.to_thread(_ls, self._library(), data.path)
        except ValueError as exc:
            return self._error(str(exc))
        except OSError:
            return self._error("资料库读取失败")
        return ToolChunk(content=[TextBlock(text=text)])


class MaterialsRead(_MaterialsTool):
    name: str = "materials_read"
    description: str = _READ_DESCRIPTION
    input_schema: dict[str, Any] = MaterialsReadInput.model_json_schema()

    async def call(self, **kwargs: Any) -> ToolChunk:
        data = MaterialsReadInput.model_validate(kwargs)
        try:
            text = await asyncio.to_thread(
                _read,
                self._library(),
                data.path,
                data.offset,
                data.limit,
            )
        except ValueError as exc:
            return self._error(str(exc))
        except OSError:
            return self._error("资料库读取失败")
        return ToolChunk(content=[TextBlock(text=text)])


class MaterialsGrep(_MaterialsTool):
    name: str = "materials_grep"
    description: str = _GREP_DESCRIPTION
    input_schema: dict[str, Any] = MaterialsGrepInput.model_json_schema()

    async def call(self, **kwargs: Any) -> ToolChunk:
        data = MaterialsGrepInput.model_validate(kwargs)
        try:
            text = await asyncio.to_thread(
                _grep,
                self._library(),
                data.path,
                data.query,
                data.limit,
            )
        except ValueError as exc:
            return self._error(str(exc))
        except OSError:
            return self._error("资料库读取失败")
        return ToolChunk(content=[TextBlock(text=text)])
