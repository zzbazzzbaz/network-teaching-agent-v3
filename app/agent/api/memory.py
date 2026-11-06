import asyncio
import base64
import binascii
import logging
import re
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from datetime import date as Date
from pathlib import Path, PurePosixPath
from typing import Annotated, Literal

import frontmatter
from agentscope.app.deps import get_current_user_id
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi import Path as PathParam

from app.agent.api.schemas.memory import (
    MemoryEntryDetail,
    MemoryEntryItem,
    MemoryEntryListResponse,
)
from app.core.config import get_settings

logger = logging.getLogger(__name__)

MAX_SCAN_ENTRIES = 5000
MAX_LIST_HEAD_BYTES = 64 * 1024
MAX_CONTENT_BYTES = 256 * 1024

_DAILY_DIR = "daily"
_DIGEST_DIR = "digest"
_DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_HEADING_PATTERN = re.compile(r"^#\s+(.+)$", re.MULTILINE)

MemoryKind = Literal["daily", "digest"]

router = APIRouter(prefix="/memory", tags=["memory"])


class InvalidMemoryEntryId(ValueError):
    pass


class MemoryEntryNotFound(LookupError):
    pass


@dataclass(frozen=True, slots=True)
class MemoryEntry:
    entry_id: str
    kind: MemoryKind
    title: str
    summary: str
    date: str | None
    session_id: str | None
    updated_at: datetime
    content: str | None = None
    content_truncated: bool = False


@dataclass(frozen=True, slots=True)
class MemoryEntryPage:
    items: list[MemoryEntry]
    total: int
    truncated: bool


def get_memory_dir() -> Path:
    return get_settings().memory_dir


@router.get(
    "/entries",
    response_model=MemoryEntryListResponse,
    summary="List memory entries",
)
async def list_memory_entries(
    user_id: Annotated[str, Depends(get_current_user_id)],
    memory_dir: Annotated[Path, Depends(get_memory_dir)],
    kind: Annotated[Literal["daily", "digest"], Query()] = "daily",
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    date: Annotated[str | None, Query(pattern=r"^\d{4}-\d{2}-\d{2}$")] = None,
    session_id: Annotated[str | None, Query()] = None,
) -> MemoryEntryListResponse:
    root = _user_root(memory_dir, user_id)
    if date is not None:
        try:
            Date.fromisoformat(date)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="无效的日期",
            ) from exc

    normalized_session_id = None
    if session_id is not None:
        normalized_session_id = normalize_session_id(session_id)
        if normalized_session_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="无效的会话标识",
            )

    try:
        page = await asyncio.to_thread(
            list_entries,
            root,
            kind=kind,
            limit=limit,
            offset=offset,
            date=date,
            session_id=normalized_session_id,
        )
    except OSError as exc:
        logger.warning("memory scan failed: user_id=%s", user_id, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="记忆暂不可用",
        ) from exc

    items = [_to_item(entry) for entry in page.items]
    return MemoryEntryListResponse(
        items=items,
        total=page.total,
        has_more=offset + len(items) < page.total,
        truncated=page.truncated,
    )


@router.get(
    "/entries/{entry_id}",
    response_model=MemoryEntryDetail,
    summary="Read one memory entry",
)
async def read_memory_entry(
    entry_id: Annotated[str, PathParam(max_length=512)],
    user_id: Annotated[str, Depends(get_current_user_id)],
    memory_dir: Annotated[Path, Depends(get_memory_dir)],
) -> MemoryEntryDetail:
    root = _user_root(memory_dir, user_id)
    try:
        entry = await asyncio.to_thread(get_entry, root, entry_id)
    except InvalidMemoryEntryId as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的记忆标识",
        ) from exc
    except MemoryEntryNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="记忆不存在",
        ) from exc
    except OSError as exc:
        logger.warning(
            "read memory entry failed: user_id=%s entry_id=%s",
            user_id,
            entry_id,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="记忆暂不可用",
        ) from exc

    return MemoryEntryDetail(
        **_to_item(entry).model_dump(),
        content=entry.content or "",
        content_truncated=entry.content_truncated,
    )


def encode_entry_id(relative: str) -> str:
    return base64.urlsafe_b64encode(relative.encode("utf-8")).decode("ascii").rstrip("=")


def decode_entry_id(entry_id: str) -> str:
    if not entry_id or len(entry_id) > 512:
        raise InvalidMemoryEntryId

    padding = "=" * (-len(entry_id) % 4)
    try:
        raw = base64.b64decode(
            entry_id + padding,
            altchars=b"-_",
            validate=True,
        )
        relative = raw.decode("utf-8")
    except (binascii.Error, UnicodeDecodeError, ValueError) as exc:
        raise InvalidMemoryEntryId from exc

    if not relative or "\\" in relative or "\x00" in relative or relative.startswith("/"):
        raise InvalidMemoryEntryId

    path = PurePosixPath(relative)
    if (
        not path.parts
        or path.parts[0] not in {_DAILY_DIR, _DIGEST_DIR}
        or path.suffix != ".md"
        or ".." in path.parts
        or "." in path.parts
    ):
        raise InvalidMemoryEntryId

    if path.parts[0] == _DAILY_DIR and (
        len(path.parts) != 3 or not _DATE_PATTERN.fullmatch(path.parts[1])
    ):
        raise InvalidMemoryEntryId

    return path.as_posix()


def normalize_session_id(value: object) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return str(uuid.UUID(text))
    except ValueError:
        return None


def list_entries(
    root: Path,
    *,
    kind: MemoryKind,
    limit: int,
    offset: int,
    date: str | None = None,
    session_id: str | None = None,
) -> MemoryEntryPage:
    root = root.resolve()
    if not root.is_dir():
        return MemoryEntryPage(items=[], total=0, truncated=False)

    entries: list[MemoryEntry] = []
    truncated = False
    scanned = 0
    paths = _iter_daily_paths(root, date) if kind == "daily" else _iter_digest_paths(root)

    try:
        for path in paths:
            if scanned >= MAX_SCAN_ENTRIES:
                truncated = True
                break
            scanned += 1
            try:
                entry = _entry_from_path(root, path, kind, include_content=False)
            except OSError, ValueError:
                logger.warning("skip unreadable memory entry: path=%s", path, exc_info=True)
                continue
            if session_id is not None and entry.session_id != session_id:
                continue
            entries.append(entry)
    except OSError:
        logger.warning("memory scan failed: root=%s", root, exc_info=True)
        truncated = True

    if kind == "daily":
        entries.sort(
            key=lambda entry: (entry.date or "", entry.updated_at, entry.entry_id),
            reverse=True,
        )
    else:
        entries.sort(key=lambda entry: (entry.updated_at, entry.entry_id), reverse=True)

    total = len(entries)
    return MemoryEntryPage(
        items=entries[offset : offset + limit],
        total=total,
        truncated=truncated,
    )


def get_entry(root: Path, entry_id: str) -> MemoryEntry:
    relative = decode_entry_id(entry_id)
    root = root.resolve()
    path = _resolve_path(root, relative)
    if not path.is_file():
        raise MemoryEntryNotFound
    kind: MemoryKind = "daily" if relative.startswith(f"{_DAILY_DIR}/") else "digest"
    return _entry_from_path(root, path, kind, include_content=True)


def _iter_daily_paths(root: Path, date: str | None):
    daily_root = root / _DAILY_DIR
    if not daily_root.is_dir():
        return

    for day_dir in sorted(daily_root.iterdir()):
        if not day_dir.is_dir() or day_dir.is_symlink():
            continue
        if not _DATE_PATTERN.fullmatch(day_dir.name):
            continue
        if date is not None and day_dir.name != date:
            continue
        for path in sorted(day_dir.iterdir()):
            if path.is_file() and not path.is_symlink() and path.suffix == ".md":
                yield path


def _iter_digest_paths(root: Path):
    digest_root = root / _DIGEST_DIR
    if not digest_root.is_dir():
        return

    for path in sorted(digest_root.rglob("*.md")):
        if path.is_file() and not path.is_symlink():
            yield path


def _resolve_path(root: Path, relative: str) -> Path:
    candidate = root / relative
    if candidate.is_symlink():
        raise InvalidMemoryEntryId
    path = candidate.resolve()
    if not path.is_relative_to(root) or path.suffix != ".md":
        raise InvalidMemoryEntryId
    return path


def _entry_from_path(
    root: Path,
    path: Path,
    kind: MemoryKind,
    *,
    include_content: bool,
) -> MemoryEntry:
    path = path.resolve()
    if not path.is_relative_to(root):
        raise InvalidMemoryEntryId

    stat = path.stat()
    max_bytes = MAX_CONTENT_BYTES if include_content else MAX_LIST_HEAD_BYTES
    text, truncated = _read_text(path, max_bytes)
    metadata, body = _load_post(text)

    title = _text(metadata.get("name")) or _first_heading(body) or path.stem
    summary = _text(metadata.get("description")) or _first_line(body)
    relative = path.relative_to(root).as_posix()

    return MemoryEntry(
        entry_id=encode_entry_id(relative),
        kind=kind,
        title=title,
        summary=summary[:160],
        date=path.parent.name if kind == "daily" else None,
        session_id=normalize_session_id(metadata.get("session_id")),
        updated_at=datetime.fromtimestamp(stat.st_mtime, tz=UTC),
        content=body if include_content else None,
        content_truncated=truncated if include_content else False,
    )


def _read_text(path: Path, max_bytes: int) -> tuple[str, bool]:
    size = path.stat().st_size
    with path.open("rb") as file:
        data = file.read(max_bytes)
    return data.decode("utf-8", errors="replace"), size > max_bytes


def _load_post(text: str) -> tuple[dict, str]:
    try:
        post = frontmatter.loads(text)
    except Exception:
        logger.warning("failed to parse memory frontmatter", exc_info=True)
        return {}, text
    return dict(post.metadata or {}), post.content or ""


def _text(value: object) -> str:
    return str(value).strip() if value is not None else ""


def _first_heading(body: str) -> str:
    match = _HEADING_PATTERN.search(body)
    return match.group(1).strip() if match else ""


def _first_line(body: str) -> str:
    for line in body.splitlines():
        text = line.strip()
        if not text or text.startswith("---") or text.startswith("#"):
            continue
        return text
    return ""


def _user_root(memory_dir: Path, user_id: str) -> Path:
    try:
        parsed = uuid.UUID(user_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的用户标识",
        ) from exc
    return memory_dir / str(parsed)


def _to_item(entry: MemoryEntry) -> MemoryEntryItem:
    return MemoryEntryItem(
        id=entry.entry_id,
        kind=entry.kind,
        title=entry.title,
        summary=entry.summary,
        date=entry.date,
        session_id=entry.session_id,
        updated_at=entry.updated_at,
    )
