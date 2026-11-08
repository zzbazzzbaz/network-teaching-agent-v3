import logging
from collections.abc import AsyncIterator
from typing import Annotated

import httpx
from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse

from app.api.dependencies import CurrentUser
from app.api.services import knowledge_service
from app.shared.dto.knowledge import (
    KnowledgeBaseCreateRequest,
    KnowledgeBaseItem,
    KnowledgeBaseListResponse,
    KnowledgeBaseUpdateRequest,
    KnowledgeDocumentListResponse,
    KnowledgeDocumentStatusResponse,
    KnowledgeDocumentUploadResponse,
    KnowledgeSupportedContentTypesResponse,
)
from app.shared.errors import RemoteServiceError, forbidden, not_found

logger = logging.getLogger(__name__)

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


def stream_headers(upstream: httpx.Response) -> dict[str, str]:
    headers: dict[str, str] = {"X-Content-Type-Options": "nosniff"}
    for key in ("content-disposition", "content-length"):
        value = upstream.headers.get(key)
        if value:
            headers[key.title()] = value
    return headers


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
    "/bases/{knowledge_base_id}/documents",
    response_model=KnowledgeDocumentUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="上传文档",
)
async def upload_document(
    knowledge_base_id: str,
    current_user: CurrentUser,
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
            str(current_user.id),
            knowledge_base_id,
            filename=filename,
            content=content,
            content_type=media_type,
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
    "/bases/{knowledge_base_id}/documents/{document_id}",
    summary="下载文档",
)
async def download_document(
    knowledge_base_id: str,
    document_id: str,
    current_user: CurrentUser,
    download: bool = False,
) -> StreamingResponse:
    stream = knowledge_service.stream_document(
        str(current_user.id),
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
            logger.warning("knowledge document stream interrupted: %s", document_id)
        finally:
            await stream.__aexit__(None, None, None)

    return StreamingResponse(
        relay(),
        media_type=upstream.headers.get("content-type", "application/octet-stream"),
        headers=stream_headers(upstream),
    )


@router.get(
    "/supported_content_types",
    response_model=KnowledgeSupportedContentTypesResponse,
    summary="支持的文件类型",
)
async def supported_content_types(
    _current_user: CurrentUser,
) -> KnowledgeSupportedContentTypesResponse:
    return knowledge_service.supported_content_types()
