import logging
import uuid
from collections.abc import AsyncIterator
from typing import Annotated

import httpx
from fastapi import APIRouter, File, Form, Query, UploadFile, status
from fastapi.responses import StreamingResponse

from app.api.dependencies import AdminUser, SessionDep
from app.api.endpoints.knowledge import knowledge_http_error, stream_headers
from app.api.repositories.models import User
from app.api.services import knowledge_service, user_service
from app.shared.constants import SYSTEM_USER_ID
from app.shared.dto.knowledge import (
    KnowledgeBaseCreateRequest,
    KnowledgeBaseItem,
    KnowledgeBaseListResponse,
    KnowledgeBaseUpdateRequest,
    KnowledgeDocumentListResponse,
    KnowledgeDocumentStatusResponse,
    KnowledgeDocumentUploadResponse,
)
from app.shared.errors import RemoteServiceError, not_found

logger = logging.getLogger(__name__)

public_router = APIRouter(prefix="/knowledge/public", tags=["管理-公共知识库"])
user_router = APIRouter(prefix="/users", tags=["管理-学生知识库"])


async def _target_user(session: SessionDep, user_id: uuid.UUID) -> User:
    try:
        return await user_service.get_user(session, user_id)
    except user_service.UserNotFoundError as exc:
        raise not_found() from exc


@public_router.get("/bases", response_model=KnowledgeBaseListResponse, summary="公共知识库列表")
async def list_public_bases(_admin: AdminUser) -> KnowledgeBaseListResponse:
    try:
        return await knowledge_service.list_public_bases()
    except knowledge_service.KnowledgeError as exc:
        raise knowledge_http_error(exc) from exc


@public_router.post(
    "/bases",
    response_model=KnowledgeBaseItem,
    status_code=status.HTTP_201_CREATED,
    summary="创建公共知识库",
)
async def create_public_base(
    payload: KnowledgeBaseCreateRequest,
    _admin: AdminUser,
) -> KnowledgeBaseItem:
    try:
        return await knowledge_service.create_base(
            SYSTEM_USER_ID,
            payload,
            mode="public",
        )
    except knowledge_service.KnowledgeError as exc:
        raise knowledge_http_error(exc) from exc


@public_router.patch(
    "/bases/{knowledge_base_id}",
    response_model=KnowledgeBaseItem,
    summary="修改公共知识库",
)
async def update_public_base(
    knowledge_base_id: str,
    payload: KnowledgeBaseUpdateRequest,
    _admin: AdminUser,
) -> KnowledgeBaseItem:
    try:
        return await knowledge_service.update_base(
            SYSTEM_USER_ID,
            knowledge_base_id,
            payload,
            mode="public",
        )
    except knowledge_service.KnowledgeError as exc:
        raise knowledge_http_error(exc) from exc


@public_router.delete(
    "/bases/{knowledge_base_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除公共知识库",
)
async def delete_public_base(knowledge_base_id: str, _admin: AdminUser) -> None:
    try:
        await knowledge_service.delete_base(SYSTEM_USER_ID, knowledge_base_id)
    except knowledge_service.KnowledgeError as exc:
        raise knowledge_http_error(exc) from exc


@public_router.get(
    "/bases/{knowledge_base_id}/documents",
    response_model=KnowledgeDocumentListResponse,
    summary="公共知识库文档列表",
)
async def list_public_documents(
    knowledge_base_id: str,
    _admin: AdminUser,
) -> KnowledgeDocumentListResponse:
    try:
        return await knowledge_service.list_documents(
            SYSTEM_USER_ID,
            knowledge_base_id,
        )
    except knowledge_service.KnowledgeError as exc:
        raise knowledge_http_error(exc) from exc


@public_router.get(
    "/bases/{knowledge_base_id}/documents/status",
    response_model=KnowledgeDocumentStatusResponse,
    summary="公共知识库文档索引状态",
)
async def public_document_status(
    knowledge_base_id: str,
    _admin: AdminUser,
    ids: Annotated[str, Query()],
) -> KnowledgeDocumentStatusResponse:
    document_ids = [token for token in (part.strip() for part in ids.split(",")) if token]
    try:
        return await knowledge_service.document_status(
            SYSTEM_USER_ID,
            knowledge_base_id,
            document_ids,
        )
    except knowledge_service.KnowledgeError as exc:
        raise knowledge_http_error(exc) from exc


@public_router.post(
    "/bases/{knowledge_base_id}/documents",
    response_model=KnowledgeDocumentUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="上传公共知识库文档",
)
async def upload_public_document(
    knowledge_base_id: str,
    _admin: AdminUser,
    file: Annotated[UploadFile, File()],
    content_type: Annotated[str | None, Form()] = None,
) -> KnowledgeDocumentUploadResponse:
    filename = file.filename or "uploaded_file"
    declared_size = file.size or 0
    if declared_size > 0:
        knowledge_service.validate_upload(filename=filename, size=declared_size)
    content = await file.read()
    knowledge_service.validate_upload(filename=filename, size=len(content))
    media_type = content_type or file.content_type or "application/octet-stream"
    try:
        return await knowledge_service.upload_document(
            SYSTEM_USER_ID,
            knowledge_base_id,
            filename=filename,
            content=content,
            content_type=media_type,
        )
    except knowledge_service.KnowledgeError as exc:
        raise knowledge_http_error(exc) from exc


@public_router.delete(
    "/bases/{knowledge_base_id}/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除公共知识库文档",
)
async def delete_public_document(
    knowledge_base_id: str,
    document_id: str,
    _admin: AdminUser,
) -> None:
    try:
        await knowledge_service.delete_document(
            SYSTEM_USER_ID,
            knowledge_base_id,
            document_id,
        )
    except knowledge_service.KnowledgeError as exc:
        raise knowledge_http_error(exc) from exc


@public_router.get(
    "/bases/{knowledge_base_id}/documents/{document_id}",
    summary="下载公共知识库文档",
)
async def download_public_document(
    knowledge_base_id: str,
    document_id: str,
    _admin: AdminUser,
    download: bool = False,
) -> StreamingResponse:
    stream = knowledge_service.stream_document(
        SYSTEM_USER_ID,
        knowledge_base_id,
        document_id,
        download=download,
    )
    try:
        upstream = await stream.__aenter__()
    except RemoteServiceError as exc:
        raise knowledge_http_error(knowledge_service.translate_remote_error(exc)) from exc

    async def relay() -> AsyncIterator[bytes]:
        try:
            async for chunk in upstream.aiter_raw():
                yield chunk
        except httpx.HTTPError:
            logger.warning("public knowledge document stream interrupted: %s", document_id)
        finally:
            await stream.__aexit__(None, None, None)

    return StreamingResponse(
        relay(),
        media_type=upstream.headers.get("content-type", "application/octet-stream"),
        headers=stream_headers(upstream),
    )


@user_router.get(
    "/{user_id}/knowledge/bases",
    response_model=KnowledgeBaseListResponse,
    summary="查看学生私人知识库",
)
async def list_user_bases(
    user_id: uuid.UUID,
    session: SessionDep,
    _admin: AdminUser,
) -> KnowledgeBaseListResponse:
    user = await _target_user(session, user_id)
    try:
        return await knowledge_service.list_bases(str(user.id), mode="readonly")
    except knowledge_service.KnowledgeError as exc:
        raise knowledge_http_error(exc) from exc


@user_router.get(
    "/{user_id}/knowledge/bases/{knowledge_base_id}/documents",
    response_model=KnowledgeDocumentListResponse,
    summary="查看学生知识库文档",
)
async def list_user_documents(
    user_id: uuid.UUID,
    knowledge_base_id: str,
    session: SessionDep,
    _admin: AdminUser,
) -> KnowledgeDocumentListResponse:
    user = await _target_user(session, user_id)
    try:
        return await knowledge_service.list_documents(str(user.id), knowledge_base_id)
    except knowledge_service.KnowledgeError as exc:
        raise knowledge_http_error(exc) from exc


@user_router.get(
    "/{user_id}/knowledge/bases/{knowledge_base_id}/documents/status",
    response_model=KnowledgeDocumentStatusResponse,
    summary="查看学生知识库文档索引状态",
)
async def user_document_status(
    user_id: uuid.UUID,
    knowledge_base_id: str,
    session: SessionDep,
    _admin: AdminUser,
    ids: Annotated[str, Query()],
) -> KnowledgeDocumentStatusResponse:
    user = await _target_user(session, user_id)
    document_ids = [token for token in (part.strip() for part in ids.split(",")) if token]
    try:
        return await knowledge_service.document_status(
            str(user.id),
            knowledge_base_id,
            document_ids,
        )
    except knowledge_service.KnowledgeError as exc:
        raise knowledge_http_error(exc) from exc


@user_router.get(
    "/{user_id}/knowledge/bases/{knowledge_base_id}/documents/{document_id}",
    summary="下载学生知识库文档",
)
async def download_user_document(
    user_id: uuid.UUID,
    knowledge_base_id: str,
    document_id: str,
    session: SessionDep,
    _admin: AdminUser,
    download: bool = False,
) -> StreamingResponse:
    user = await _target_user(session, user_id)
    stream = knowledge_service.stream_document(
        str(user.id),
        knowledge_base_id,
        document_id,
        download=download,
    )
    try:
        upstream = await stream.__aenter__()
    except RemoteServiceError as exc:
        raise knowledge_http_error(knowledge_service.translate_remote_error(exc)) from exc

    async def relay() -> AsyncIterator[bytes]:
        try:
            async for chunk in upstream.aiter_raw():
                yield chunk
        except httpx.HTTPError:
            logger.warning("user knowledge document stream interrupted: %s", document_id)
        finally:
            await stream.__aexit__(None, None, None)

    return StreamingResponse(
        relay(),
        media_type=upstream.headers.get("content-type", "application/octet-stream"),
        headers=stream_headers(upstream),
    )
