import logging
import mimetypes
import uuid
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.infra import cos
from app.api.repositories import file_repositories
from app.api.repositories.models import File, FileStatus
from app.shared.config import get_settings
from app.shared.storage_keys import PUBLIC_CACHE_CONTROL

logger = logging.getLogger(__name__)

_IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".webp"}


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


def _image_headers(content_type: str) -> dict[str, str]:
    return {
        "Content-Type": content_type,
        "Cache-Control": PUBLIC_CACHE_CONTROL,
    }


def _base_type(value: str | None) -> str:
    if not value:
        return ""
    return value.split(";", 1)[0].strip().lower()


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
    if size_bytes <= 0 or size_bytes > get_settings().storage.max_upload_bytes:
        raise FileTooLargeError
    name = _clean_name(filename)
    suffix = Path(name).suffix.lower()
    if suffix not in _IMAGE_SUFFIXES:
        raise UnsupportedFileTypeError
    content_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
    if not content_type.startswith("image/"):
        raise UnsupportedFileTypeError
    file = File(
        session_id=session_id,
        user_id=user_id,
        original_name=name,
        content_type=content_type,
        size_bytes=size_bytes,
    )
    await file_repositories.create(session, file)
    logger.info("upload requested: file_id=%s session_id=%s", file.id, session_id)
    headers = _image_headers(content_type)
    return UploadTicket(
        file_id=file.id,
        upload_url=cos.upload_url(file.storage_key, headers),
        headers=headers,
        expires_in=get_settings().cos.upload_expires,
    )


async def complete_upload(session: AsyncSession, *, user_id: uuid.UUID, file_id: uuid.UUID) -> File:
    file = await _get_owned(session, file_id=file_id, user_id=user_id)
    return await _finalize_upload(session, file)


async def _finalize_upload(session: AsyncSession, file: File) -> File:
    if file.status is FileStatus.READY:
        return file
    meta = await cos.object_meta(file.storage_key)
    if meta is None:
        logger.warning("upload missing in cos: file_id=%s", file.id)
        raise UploadIncompleteError
    if meta.size != file.size_bytes:
        logger.warning(
            "upload size mismatch: file_id=%s expected=%s actual=%s",
            file.id,
            file.size_bytes,
            meta.size,
        )
        await cos.delete_object(file.storage_key)
        raise UploadIncompleteError
    if _base_type(meta.content_type) != _base_type(file.content_type):
        logger.warning(
            "upload content type mismatch: file_id=%s expected=%s actual=%s",
            file.id,
            file.content_type,
            meta.content_type,
        )
        await cos.delete_object(file.storage_key)
        raise UploadIncompleteError
    file.status = FileStatus.READY
    session.add(file)
    await session.flush()
    logger.info("upload completed: file_id=%s size=%s", file.id, meta.size)
    return file


async def request_material_upload(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    filename: str,
    size_bytes: int,
) -> UploadTicket:
    if size_bytes <= 0 or size_bytes > get_settings().storage.max_upload_bytes:
        raise FileTooLargeError
    name = _clean_name(filename)
    suffix = Path(name).suffix.lower()
    if suffix not in _IMAGE_SUFFIXES:
        raise UnsupportedFileTypeError
    content_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
    if not content_type.startswith("image/"):
        raise UnsupportedFileTypeError
    file = File(
        session_id=None,
        user_id=user_id,
        original_name=name,
        content_type=content_type,
        size_bytes=size_bytes,
    )
    await file_repositories.create(session, file)
    logger.info("material upload requested: file_id=%s user_id=%s", file.id, user_id)
    headers = _image_headers(content_type)
    return UploadTicket(
        file_id=file.id,
        upload_url=cos.upload_url(file.storage_key, headers),
        headers=headers,
        expires_in=get_settings().cos.upload_expires,
    )


async def complete_material_upload(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    file_id: uuid.UUID,
) -> File:
    file = await _get_owned(session, file_id=file_id, user_id=user_id)
    if file.session_id is not None:
        raise AttachmentNotFoundError
    return await _finalize_upload(session, file)


async def _get_owned(session: AsyncSession, *, file_id: uuid.UUID, user_id: uuid.UUID) -> File:
    file = await file_repositories.get_by_id(session, file_id)
    if file is None or file.user_id != user_id or file.deleted_at is not None:
        logger.info("file not found: file_id=%s user_id=%s", file_id, user_id)
        raise AttachmentNotFoundError
    return file


def public_url(file: File) -> str:
    base = get_settings().cos.public_base_url.rstrip("/")
    return f"{base}/{file.storage_key}"


def material_markdown(file: File) -> str:
    name = file.original_name.replace("]", "\\]")
    return f"![{name}]({public_url(file)})"
