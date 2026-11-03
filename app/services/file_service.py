import logging
import mimetypes
import uuid
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.infra import cos
from app.repositories import file_repositories
from app.repositories.models import File, FileStatus

logger = logging.getLogger(__name__)

_ALLOWED_SUFFIXES = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".bmp",
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".txt",
    ".md",
    ".csv",
    ".zip",
}


class FileError(Exception):
    pass


class SessionNotFoundError(FileError):
    pass


class AttachmentNotFoundError(FileError):
    pass


class UnsupportedFileTypeError(FileError):
    pass


class FileTooLargeError(FileError):
    pass


class UploadIncompleteError(FileError):
    pass


@dataclass(frozen=True, slots=True)
class UploadTicket:
    file_id: uuid.UUID
    upload_url: str
    thumb_upload_url: str | None
    headers: dict[str, str]
    expires_in: int


def _clean_name(filename: str) -> str:
    name = "".join(ch for ch in Path(filename).name if ch.isprintable()).strip()
    if not name or name in {".", ".."}:
        raise UnsupportedFileTypeError
    suffix = Path(name).suffix
    if len(name) > 255:
        name = name[: 255 - len(suffix)] + suffix
    return name


async def request_upload(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    filename: str,
    size_bytes: int,
) -> UploadTicket:
    if not await file_repositories.session_owned_by(
        session, session_id=session_id, user_id=user_id
    ):
        raise SessionNotFoundError
    if size_bytes <= 0 or size_bytes > get_settings().max_upload_bytes:
        raise FileTooLargeError
    name = _clean_name(filename)
    suffix = Path(name).suffix.lower()
    if suffix not in _ALLOWED_SUFFIXES:
        raise UnsupportedFileTypeError
    content_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
    file = File(
        session_id=session_id,
        user_id=user_id,
        original_name=name,
        content_type=content_type,
        size_bytes=size_bytes,
    )
    await file_repositories.create(session, file)
    logger.info("upload requested: file_id=%s session_id=%s", file.id, session_id)
    return UploadTicket(
        file_id=file.id,
        upload_url=cos.upload_url(file.storage_key, content_type),
        thumb_upload_url=(
            cos.upload_url(file.thumb_key, "image/jpeg")
            if content_type.startswith("image/")
            else None
        ),
        headers={"Content-Type": content_type},
        expires_in=get_settings().cos.upload_expires,
    )


async def complete_upload(session: AsyncSession, *, user_id: uuid.UUID, file_id: uuid.UUID) -> File:
    file = await _get_owned(session, file_id=file_id, user_id=user_id)
    if file.status is FileStatus.READY:
        return file
    size = await cos.object_size(file.storage_key)
    if size is None:
        logger.warning("upload missing in cos: file_id=%s", file.id)
        raise UploadIncompleteError
    if size != file.size_bytes:
        logger.warning(
            "upload size mismatch: file_id=%s expected=%s actual=%s",
            file.id,
            file.size_bytes,
            size,
        )
        await cos.delete_object(file.storage_key)
        raise UploadIncompleteError
    if file.content_type.startswith("image/"):
        file.has_thumb = await cos.object_size(file.thumb_key) is not None
    file.status = FileStatus.READY
    session.add(file)
    await session.flush()
    logger.info("upload completed: file_id=%s size=%s", file.id, size)
    return file


async def list_files(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    limit: int,
    offset: int,
) -> tuple[list[File], int]:
    if not await file_repositories.session_owned_by(
        session, session_id=session_id, user_id=user_id
    ):
        raise SessionNotFoundError
    return await file_repositories.list_by_session(
        session,
        session_id=session_id,
        user_id=user_id,
        limit=limit,
        offset=offset,
    )


async def get_file(session: AsyncSession, *, user_id: uuid.UUID, file_id: uuid.UUID) -> File:
    file = await _get_owned(session, file_id=file_id, user_id=user_id)
    if file.status is not FileStatus.READY:
        raise AttachmentNotFoundError
    return file


async def _get_owned(session: AsyncSession, *, file_id: uuid.UUID, user_id: uuid.UUID) -> File:
    file = await file_repositories.get_by_id(session, file_id)
    if file is None or file.user_id != user_id or file.deleted_at is not None:
        logger.info("file not found: file_id=%s user_id=%s", file_id, user_id)
        raise AttachmentNotFoundError
    return file


def preview_url(file: File) -> str:
    return cos.download_url(file.storage_key, file.original_name, file.content_type, inline=True)


def download_url(file: File) -> str:
    return cos.download_url(file.storage_key, file.original_name, file.content_type, inline=False)


def thumb_url(file: File) -> str | None:
    if not file.has_thumb:
        return None
    name = f"{Path(file.original_name).stem}.jpg"
    return cos.download_url(file.thumb_key, name, "image/jpeg", inline=True)
