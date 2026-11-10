import asyncio
import logging
import mimetypes
import uuid
import weakref
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal
from zoneinfo import ZoneInfo

from app.api.infra import cos
from app.api.infra.agent_client import get_agent_client
from app.shared import storage_keys
from app.shared.config import get_settings
from app.shared.constants import (
    APP_TIMEZONE,
    EMBEDDING_CREDENTIAL_ID,
    EMBEDDING_CREDENTIAL_TYPE,
    EMBEDDING_DIMENSIONS,
    KNOWLEDGE_ALLOWED_EXTENSIONS,
    MAX_KNOWLEDGE_DOCUMENTS,
    MAX_PRIVATE_KNOWLEDGE_BASES,
    SYSTEM_USER_ID,
)
from app.shared.dto.knowledge import (
    KnowledgeBaseCreateRequest,
    KnowledgeBaseItem,
    KnowledgeBaseListResponse,
    KnowledgeBaseUpdateRequest,
    KnowledgeDocumentDownloadUrlResponse,
    KnowledgeDocumentItem,
    KnowledgeDocumentListResponse,
    KnowledgeDocumentStatusResponse,
    KnowledgeDocumentUploadResponse,
    KnowledgeStatusCounts,
    KnowledgeSupportedContentTypesResponse,
    KnowledgeVisibility,
)
from app.shared.errors import RemoteServiceError

KnowledgeViewMode = Literal["mine", "public", "readonly"]

logger = logging.getLogger(__name__)

_MEDIA_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/markdown",
    "text/plain",
    "text/html",
]

_EXTENSION_MEDIA_TYPES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".md": "text/markdown",
    ".txt": "text/plain",
    ".html": "text/html",
}

_upload_locks: weakref.WeakValueDictionary[str, asyncio.Lock] = weakref.WeakValueDictionary()


class KnowledgeError(Exception):
    pass


class KnowledgeNotFoundError(KnowledgeError):
    pass


class KnowledgeForbiddenError(KnowledgeError):
    pass


class KnowledgeConflictError(KnowledgeError):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class KnowledgeInvalidError(KnowledgeError):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class KnowledgeFileTooLargeError(KnowledgeError):
    pass


class KnowledgeUnavailableError(KnowledgeError):
    pass


@dataclass(frozen=True, slots=True)
class KnowledgeUploadTicket:
    upload_id: str
    upload_url: str
    headers: dict[str, str]
    expires_in: int


def translate_remote_error(exc: RemoteServiceError) -> KnowledgeError:
    if exc.status_code == 404:
        return KnowledgeNotFoundError("资源不存在")
    if exc.status_code == 403:
        return KnowledgeForbiddenError("无访问权限")
    if exc.status_code == 409:
        return KnowledgeConflictError(exc.detail or "知识库操作失败")
    if 400 <= exc.status_code < 500:
        return KnowledgeInvalidError(exc.detail or "知识库操作失败")
    return KnowledgeUnavailableError("知识库服务暂不可用")


def _as_utc(value: Any) -> datetime:
    if isinstance(value, datetime):
        parsed = value
    else:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=ZoneInfo(APP_TIMEZONE))
    return parsed.astimezone(UTC)


def _base_item(
    view: dict[str, Any],
    *,
    visibility: KnowledgeVisibility,
    editable: bool,
) -> KnowledgeBaseItem:
    return KnowledgeBaseItem(
        id=view["id"],
        name=view["name"],
        description=view.get("description") or "",
        visibility=visibility,
        editable=editable,
        document_count=view.get("document_count", 0),
        chunk_count=view.get("chunk_count", 0),
        status_counts=KnowledgeStatusCounts.model_validate(
            view.get("status_counts") or {},
        ),
        created_at=_as_utc(view["created_at"]),
        updated_at=_as_utc(view["updated_at"]),
    )


def _document_item(view: dict[str, Any]) -> KnowledgeDocumentItem:
    return KnowledgeDocumentItem(
        id=view["id"],
        filename=view["filename"],
        size=view["size"],
        content_type=view.get("content_type"),
        status=view["status"],
        error=view.get("error"),
        chunk_count=view.get("chunk_count", 0),
        created_at=_as_utc(view["created_at"]),
        updated_at=_as_utc(view["updated_at"]),
    )


async def _fetch_views(
    owner_user_id: str,
    *,
    knowledge_base_id: str | None = None,
) -> list[dict[str, Any]]:
    client = get_agent_client()
    views: list[dict[str, Any]] = []
    page = 1
    while True:
        try:
            payload = await client.list_knowledge_bases(
                user_id=owner_user_id,
                knowledge_base_id=knowledge_base_id,
                page=page,
                page_size=128,
            )
        except RemoteServiceError as exc:
            raise translate_remote_error(exc) from exc
        batch = payload.get("knowledge_bases") or []
        views.extend(batch)
        total = int(payload.get("total") or 0)
        if not batch or len(views) >= total:
            break
        page += 1
    if knowledge_base_id is not None:
        return [view for view in views if view.get("id") == knowledge_base_id]
    return views


async def list_bases(
    owner_user_id: str,
    *,
    mode: KnowledgeViewMode,
) -> KnowledgeBaseListResponse:
    views = await _fetch_views(owner_user_id)
    items: list[KnowledgeBaseItem] = []
    for view in views:
        editable = bool(view.get("editable"))
        if mode == "public":
            if not editable:
                continue
            items.append(_base_item(view, visibility="public", editable=True))
            continue
        if mode == "readonly":
            if not editable:
                continue
            items.append(_base_item(view, visibility="private", editable=False))
            continue
        items.append(
            _base_item(
                view,
                visibility="private" if editable else "public",
                editable=editable,
            ),
        )
    return KnowledgeBaseListResponse(items=items, total=len(items))


async def list_public_bases() -> KnowledgeBaseListResponse:
    return await list_bases(SYSTEM_USER_ID, mode="public")


async def list_visible_base_ids(owner_user_id: str) -> list[str]:
    response = await list_bases(owner_user_id, mode="mine")
    ordered = sorted(response.items, key=lambda item: not item.editable)
    return [item.id for item in ordered]


def _create_payload(name: str, description: str) -> dict[str, Any]:
    return {
        "name": name,
        "description": description,
        "embedding_model_config": {
            "type": EMBEDDING_CREDENTIAL_TYPE,
            "credential_id": EMBEDDING_CREDENTIAL_ID,
            "model": get_settings().embedding.model,
            "dimensions": EMBEDDING_DIMENSIONS,
            "parameters": {},
        },
        "chunker_config": {"type": "approx_token", "parameters": {}},
    }


async def create_base(
    owner_user_id: str,
    payload: KnowledgeBaseCreateRequest,
    *,
    mode: KnowledgeViewMode,
) -> KnowledgeBaseItem:
    name = payload.name.strip()
    description = payload.description.strip()
    if not name:
        raise KnowledgeInvalidError("名称不能为空")

    if mode == "mine":
        existing = await list_bases(owner_user_id, mode="mine")
        private_count = sum(1 for item in existing.items if item.editable)
        if private_count >= MAX_PRIVATE_KNOWLEDGE_BASES:
            raise KnowledgeConflictError("私人知识库数量已达上限")

    try:
        created = await get_agent_client().create_knowledge_base(
            user_id=owner_user_id,
            payload=_create_payload(name, description),
        )
    except RemoteServiceError as exc:
        raise translate_remote_error(exc) from exc

    knowledge_base_id = str(created["knowledge_base_id"])
    views = await _fetch_views(
        owner_user_id,
        knowledge_base_id=knowledge_base_id,
    )
    if not views:
        raise KnowledgeUnavailableError("知识库服务暂不可用")
    visibility = "public" if mode == "public" else "private"
    return _base_item(views[0], visibility=visibility, editable=True)


async def update_base(
    owner_user_id: str,
    knowledge_base_id: str,
    payload: KnowledgeBaseUpdateRequest,
    *,
    mode: KnowledgeViewMode,
) -> KnowledgeBaseItem:
    body: dict[str, Any] = {}
    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise KnowledgeInvalidError("名称不能为空")
        body["name"] = name
    if payload.description is not None:
        body["description"] = payload.description.strip()
    if not body:
        raise KnowledgeInvalidError("没有需要修改的内容")

    try:
        await get_agent_client().update_knowledge_base(
            user_id=owner_user_id,
            knowledge_base_id=knowledge_base_id,
            payload=body,
        )
    except RemoteServiceError as exc:
        raise translate_remote_error(exc) from exc

    views = await _fetch_views(
        owner_user_id,
        knowledge_base_id=knowledge_base_id,
    )
    if not views:
        raise KnowledgeNotFoundError("资源不存在")
    visibility = "public" if mode == "public" else "private"
    return _base_item(views[0], visibility=visibility, editable=True)


async def delete_base(owner_user_id: str, knowledge_base_id: str) -> None:
    try:
        await get_agent_client().delete_knowledge_base(
            user_id=owner_user_id,
            knowledge_base_id=knowledge_base_id,
        )
    except RemoteServiceError as exc:
        raise translate_remote_error(exc) from exc


async def list_documents(
    owner_user_id: str,
    knowledge_base_id: str,
) -> KnowledgeDocumentListResponse:
    client = get_agent_client()
    items: list[KnowledgeDocumentItem] = []
    page = 1
    while True:
        try:
            payload = await client.list_knowledge_documents(
                user_id=owner_user_id,
                knowledge_base_id=knowledge_base_id,
                page=page,
                page_size=128,
            )
        except RemoteServiceError as exc:
            raise translate_remote_error(exc) from exc
        batch = payload.get("documents") or []
        items.extend(_document_item(view) for view in batch)
        total = int(payload.get("total") or 0)
        if not batch or len(items) >= total:
            break
        page += 1
    return KnowledgeDocumentListResponse(items=items, total=len(items))


async def document_status(
    owner_user_id: str,
    knowledge_base_id: str,
    document_ids: list[str],
) -> KnowledgeDocumentStatusResponse:
    if not document_ids:
        return KnowledgeDocumentStatusResponse(items=[])
    try:
        payload = await get_agent_client().list_knowledge_document_status(
            user_id=owner_user_id,
            knowledge_base_id=knowledge_base_id,
            document_ids=document_ids,
        )
    except RemoteServiceError as exc:
        raise translate_remote_error(exc) from exc
    return KnowledgeDocumentStatusResponse(
        items=[_document_item(view) for view in payload.get("items") or []],
    )


def validate_upload(
    *,
    filename: str,
    size: int,
) -> None:
    suffix = Path(filename).suffix.lower()
    if suffix not in KNOWLEDGE_ALLOWED_EXTENSIONS:
        raise KnowledgeInvalidError("不支持的文件类型")
    if size <= 0:
        raise KnowledgeInvalidError("文件为空")
    if size > get_settings().storage.knowledge_max_upload_bytes:
        raise KnowledgeFileTooLargeError


def _clean_filename(filename: str) -> str:
    name = "".join(ch for ch in Path(filename).name if ch.isprintable()).strip()
    if not name or name in {".", ".."}:
        raise KnowledgeInvalidError("文件名无效")
    suffix = Path(name).suffix
    if len(name) > 255:
        name = name[: 255 - len(suffix)] + suffix
    return name


def _content_type_for(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    return (
        _EXTENSION_MEDIA_TYPES.get(suffix)
        or mimetypes.guess_type(filename)[0]
        or "application/octet-stream"
    )


def _base_type(value: str | None) -> str:
    if not value:
        return ""
    return value.split(";", 1)[0].strip().lower()


def _normalize_upload_id(upload_id: str) -> str:
    try:
        return uuid.UUID(hex=upload_id).hex
    except ValueError as exc:
        raise KnowledgeInvalidError("上传标识无效") from exc


def _upload_lock(key: str) -> asyncio.Lock:
    lock = _upload_locks.get(key)
    if lock is None:
        lock = asyncio.Lock()
        _upload_locks[key] = lock
    return lock


async def _delete_temp_quietly(key: str) -> None:
    try:
        await cos.delete_object(key)
    except Exception:
        logger.warning("knowledge temp object delete failed: %s", key, exc_info=True)


async def create_upload_url(
    owner_user_id: str,
    knowledge_base_id: str,
    *,
    uploader_user_id: str,
    filename: str,
    size_bytes: int,
) -> KnowledgeUploadTicket:
    name = _clean_filename(filename)
    validate_upload(filename=name, size=size_bytes)
    existing = await list_documents(owner_user_id, knowledge_base_id)
    if existing.total >= MAX_KNOWLEDGE_DOCUMENTS:
        raise KnowledgeConflictError("文档数量已达上限")
    upload_id = uuid.uuid4().hex
    content_type = _content_type_for(name)
    key = storage_keys.knowledge_temp_key(uploader_user_id, upload_id)
    headers = {"Content-Type": content_type}
    return KnowledgeUploadTicket(
        upload_id=upload_id,
        upload_url=cos.upload_url(key, headers),
        headers=headers,
        expires_in=get_settings().cos.upload_expires,
    )


async def complete_upload(
    owner_user_id: str,
    knowledge_base_id: str,
    *,
    uploader_user_id: str,
    upload_id: str,
    filename: str,
    size_bytes: int,
    content_type: str | None,
) -> KnowledgeDocumentUploadResponse:
    del content_type
    name = _clean_filename(filename)
    validate_upload(filename=name, size=size_bytes)
    normalized_id = _normalize_upload_id(upload_id)
    expected_type = _content_type_for(name)
    key = storage_keys.knowledge_temp_key(uploader_user_id, normalized_id)

    async with _upload_lock(key):
        meta = await cos.object_meta(key)
        if meta is None:
            raise KnowledgeConflictError("上传不存在或已完成")
        if meta.size != size_bytes:
            await cos.delete_object(key)
            raise KnowledgeInvalidError("文件大小不一致")
        if _base_type(meta.content_type) != _base_type(expected_type):
            await cos.delete_object(key)
            raise KnowledgeInvalidError("文件类型不一致")
        existing = await list_documents(owner_user_id, knowledge_base_id)
        if existing.total >= MAX_KNOWLEDGE_DOCUMENTS:
            raise KnowledgeConflictError("文档数量已达上限")
        try:
            payload = await get_agent_client().upload_knowledge_document(
                user_id=owner_user_id,
                knowledge_base_id=knowledge_base_id,
                filename=name,
                content_type=expected_type,
                size=size_bytes,
                chunks=cos.iter_object(key),
            )
        except FileNotFoundError as exc:
            raise KnowledgeConflictError("上传不存在或已完成") from exc
        except RemoteServiceError as exc:
            raise translate_remote_error(exc) from exc
        await _delete_temp_quietly(key)
        return KnowledgeDocumentUploadResponse(
            id=payload["document_id"],
            filename=payload["filename"],
            status=payload["status"],
        )


async def delete_document(
    owner_user_id: str,
    knowledge_base_id: str,
    document_id: str,
) -> None:
    try:
        await get_agent_client().delete_knowledge_document(
            user_id=owner_user_id,
            knowledge_base_id=knowledge_base_id,
            document_id=document_id,
        )
    except RemoteServiceError as exc:
        raise translate_remote_error(exc) from exc


async def document_download_url(
    owner_user_id: str,
    knowledge_base_id: str,
    document_id: str,
) -> KnowledgeDocumentDownloadUrlResponse:
    status = await document_status(owner_user_id, knowledge_base_id, [document_id])
    if not status.items:
        raise KnowledgeNotFoundError("资源不存在")
    document = status.items[0]
    key = storage_keys.knowledge_key(knowledge_base_id, document_id)
    meta = await cos.object_meta(key)
    if meta is None:
        raise KnowledgeNotFoundError("资源不存在")
    content_type = meta.content_type
    if not content_type or content_type == "application/octet-stream":
        content_type = document.content_type
    return KnowledgeDocumentDownloadUrlResponse(
        url=cos.download_url(
            key,
            document.filename,
            content_type or "application/octet-stream",
            inline=False,
        ),
        filename=document.filename,
        expires_in=get_settings().cos.download_expires,
    )


def supported_content_types() -> KnowledgeSupportedContentTypesResponse:
    return KnowledgeSupportedContentTypesResponse(
        extensions=list(KNOWLEDGE_ALLOWED_EXTENSIONS),
        media_types=_MEDIA_TYPES,
    )
