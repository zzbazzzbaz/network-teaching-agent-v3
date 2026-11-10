from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.api.dependencies import CurrentUser
from app.api.services import knowledge_service
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
    KnowledgeSupportedContentTypesResponse,
)
from app.shared.errors import forbidden, not_found

router = APIRouter(prefix="/knowledge", tags=["知识库"])


def knowledge_http_error(exc: knowledge_service.KnowledgeError) -> HTTPException:
    if isinstance(exc, knowledge_service.KnowledgeNotFoundError):
        return not_found()
    if isinstance(exc, knowledge_service.KnowledgeForbiddenError):
        return forbidden()
    if isinstance(exc, knowledge_service.KnowledgeConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.detail)
    if isinstance(exc, knowledge_service.KnowledgeFileTooLargeError):
        return HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail="文件过大")
    if isinstance(exc, knowledge_service.KnowledgeInvalidError):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=exc.detail,
        )
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="知识库服务暂不可用",
    )


@router.get("/bases", response_model=KnowledgeBaseListResponse, summary="知识库列表")
async def list_bases(current_user: CurrentUser) -> KnowledgeBaseListResponse:
    try:
        return await knowledge_service.list_bases(str(current_user.id), mode="mine")
    except knowledge_service.KnowledgeError as exc:
        raise knowledge_http_error(exc) from exc


@router.post(
    "/bases",
    response_model=KnowledgeBaseItem,
    status_code=status.HTTP_201_CREATED,
    summary="创建私人知识库",
)
async def create_base(
    payload: KnowledgeBaseCreateRequest,
    current_user: CurrentUser,
) -> KnowledgeBaseItem:
    try:
        return await knowledge_service.create_base(
            str(current_user.id),
            payload,
            mode="mine",
        )
    except knowledge_service.KnowledgeError as exc:
        raise knowledge_http_error(exc) from exc


@router.patch("/bases/{knowledge_base_id}", response_model=KnowledgeBaseItem, summary="修改知识库")
async def update_base(
    knowledge_base_id: str,
    payload: KnowledgeBaseUpdateRequest,
    current_user: CurrentUser,
) -> KnowledgeBaseItem:
    try:
        return await knowledge_service.update_base(
            str(current_user.id),
            knowledge_base_id,
            payload,
            mode="mine",
        )
    except knowledge_service.KnowledgeError as exc:
        raise knowledge_http_error(exc) from exc


@router.delete(
    "/bases/{knowledge_base_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除知识库",
)
async def delete_base(knowledge_base_id: str, current_user: CurrentUser) -> None:
    try:
        await knowledge_service.delete_base(str(current_user.id), knowledge_base_id)
    except knowledge_service.KnowledgeError as exc:
        raise knowledge_http_error(exc) from exc


@router.get(
    "/bases/{knowledge_base_id}/documents",
    response_model=KnowledgeDocumentListResponse,
    summary="文档列表",
)
async def list_documents(
    knowledge_base_id: str,
    current_user: CurrentUser,
) -> KnowledgeDocumentListResponse:
    try:
        return await knowledge_service.list_documents(
            str(current_user.id),
            knowledge_base_id,
        )
    except knowledge_service.KnowledgeError as exc:
        raise knowledge_http_error(exc) from exc


@router.get(
    "/bases/{knowledge_base_id}/documents/status",
    response_model=KnowledgeDocumentStatusResponse,
    summary="文档索引状态",
)
async def document_status(
    knowledge_base_id: str,
    current_user: CurrentUser,
    ids: Annotated[str, Query()],
) -> KnowledgeDocumentStatusResponse:
    document_ids = [token for token in (part.strip() for part in ids.split(",")) if token]
    try:
        return await knowledge_service.document_status(
            str(current_user.id),
            knowledge_base_id,
            document_ids,
        )
    except knowledge_service.KnowledgeError as exc:
        raise knowledge_http_error(exc) from exc


@router.post(
    "/bases/{knowledge_base_id}/documents/upload-url",
    response_model=KnowledgeDocumentUploadUrlResponse,
    status_code=status.HTTP_201_CREATED,
    summary="申请文档上传地址",
)
async def create_document_upload_url(
    knowledge_base_id: str,
    payload: KnowledgeDocumentUploadUrlRequest,
    current_user: CurrentUser,
) -> KnowledgeDocumentUploadUrlResponse:
    try:
        ticket = await knowledge_service.create_upload_url(
            str(current_user.id),
            knowledge_base_id,
            uploader_user_id=str(current_user.id),
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


@router.post(
    "/bases/{knowledge_base_id}/documents/complete",
    response_model=KnowledgeDocumentUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="确认文档上传",
)
async def complete_document_upload(
    knowledge_base_id: str,
    payload: KnowledgeDocumentCompleteRequest,
    current_user: CurrentUser,
) -> KnowledgeDocumentUploadResponse:
    try:
        return await knowledge_service.complete_upload(
            str(current_user.id),
            knowledge_base_id,
            uploader_user_id=str(current_user.id),
            upload_id=payload.upload_id,
            filename=payload.filename,
            size_bytes=payload.size_bytes,
            content_type=payload.content_type,
        )
    except knowledge_service.KnowledgeError as exc:
        raise knowledge_http_error(exc) from exc


@router.delete(
    "/bases/{knowledge_base_id}/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除文档",
)
async def delete_document(
    knowledge_base_id: str,
    document_id: str,
    current_user: CurrentUser,
) -> None:
    try:
        await knowledge_service.delete_document(
            str(current_user.id),
            knowledge_base_id,
            document_id,
        )
    except knowledge_service.KnowledgeError as exc:
        raise knowledge_http_error(exc) from exc


@router.get(
    "/bases/{knowledge_base_id}/documents/{document_id}/download-url",
    response_model=KnowledgeDocumentDownloadUrlResponse,
    summary="获取文档下载地址",
)
async def document_download_url(
    knowledge_base_id: str,
    document_id: str,
    response: Response,
    current_user: CurrentUser,
) -> KnowledgeDocumentDownloadUrlResponse:
    try:
        result = await knowledge_service.document_download_url(
            str(current_user.id),
            knowledge_base_id,
            document_id,
        )
    except knowledge_service.KnowledgeError as exc:
        raise knowledge_http_error(exc) from exc
    response.headers["Cache-Control"] = "no-store"
    return result


@router.get(
    "/supported_content_types",
    response_model=KnowledgeSupportedContentTypesResponse,
    summary="支持的文件类型",
)
async def supported_content_types(
    _current_user: CurrentUser,
) -> KnowledgeSupportedContentTypesResponse:
    return knowledge_service.supported_content_types()
