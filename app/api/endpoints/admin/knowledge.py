import uuid
from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.dependencies import AdminUser, SessionDep
from app.api.endpoints.knowledge import knowledge_http_error
from app.api.repositories.models import User
from app.api.services import knowledge_service, user_service
from app.shared.constants import SYSTEM_USER_ID
from app.shared.dto.knowledge import (
    KnowledgeBaseCreateRequest,
    KnowledgeBaseItem,
    KnowledgeBaseListResponse,
    KnowledgeBaseUpdateRequest,
    KnowledgeDocumentCompleteRequest,
    KnowledgeDocumentDownloadUrlResponse,
    KnowledgeDocumentListResponse,
    KnowledgeDocumentStatusResponse,
    KnowledgeDocumentUploadResponse,
    KnowledgeDocumentUploadUrlRequest,
    KnowledgeDocumentUploadUrlResponse,
)
from app.shared.errors import not_found

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
    "/bases/{knowledge_base_id}/documents/upload-url",
    response_model=KnowledgeDocumentUploadUrlResponse,
    status_code=status.HTTP_201_CREATED,
    summary="申请公共知识库文档上传地址",
)
async def create_public_document_upload_url(
    knowledge_base_id: str,
    payload: KnowledgeDocumentUploadUrlRequest,
    admin: AdminUser,
) -> KnowledgeDocumentUploadUrlResponse:
    try:
        ticket = await knowledge_service.create_upload_url(
            SYSTEM_USER_ID,
            knowledge_base_id,
            uploader_user_id=str(admin.id),
            filename=payload.filename,
            size_bytes=payload.size_bytes,
        )
    except knowledge_service.KnowledgeError as exc:
        raise knowledge_http_error(exc) from exc
    return KnowledgeDocumentUploadUrlResponse(
        upload_id=ticket.upload_id,
        upload_url=ticket.upload_url,
        headers=ticket.headers,
        expires_in=ticket.expires_in,
    )


@public_router.post(
    "/bases/{knowledge_base_id}/documents/complete",
    response_model=KnowledgeDocumentUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="确认公共知识库文档上传",
)
async def complete_public_document_upload(
    knowledge_base_id: str,
    payload: KnowledgeDocumentCompleteRequest,
    admin: AdminUser,
) -> KnowledgeDocumentUploadResponse:
    try:
        return await knowledge_service.complete_upload(
            SYSTEM_USER_ID,
            knowledge_base_id,
            uploader_user_id=str(admin.id),
            upload_id=payload.upload_id,
            filename=payload.filename,
            size_bytes=payload.size_bytes,
            content_type=payload.content_type,
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
    "/bases/{knowledge_base_id}/documents/{document_id}/download-url",
    response_model=KnowledgeDocumentDownloadUrlResponse,
    summary="获取公共知识库文档下载地址",
)
async def public_document_download_url(
    knowledge_base_id: str,
    document_id: str,
    response: Response,
    _admin: AdminUser,
) -> KnowledgeDocumentDownloadUrlResponse:
    try:
        result = await knowledge_service.document_download_url(
            SYSTEM_USER_ID,
            knowledge_base_id,
            document_id,
        )
    except knowledge_service.KnowledgeError as exc:
        raise knowledge_http_error(exc) from exc
    response.headers["Cache-Control"] = "no-store"
    return result


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
    "/{user_id}/knowledge/bases/{knowledge_base_id}/documents/{document_id}/download-url",
    response_model=KnowledgeDocumentDownloadUrlResponse,
    summary="获取学生知识库文档下载地址",
)
async def user_document_download_url(
    user_id: uuid.UUID,
    knowledge_base_id: str,
    document_id: str,
    response: Response,
    session: SessionDep,
    _admin: AdminUser,
) -> KnowledgeDocumentDownloadUrlResponse:
    user = await _target_user(session, user_id)
    try:
        result = await knowledge_service.document_download_url(
            str(user.id),
            knowledge_base_id,
            document_id,
        )
    except knowledge_service.KnowledgeError as exc:
        raise knowledge_http_error(exc) from exc
    response.headers["Cache-Control"] = "no-store"
    return result
