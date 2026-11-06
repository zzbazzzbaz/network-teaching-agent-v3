import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status
from fastapi.responses import RedirectResponse

from app.api.dependencies import CurrentUser, SessionDep
from app.api.repositories.models import File
from app.api.services import file_service
from app.shared.dto.file import (
    FileDetail,
    FileItem,
    FileListResponse,
    UploadUrlRequest,
    UploadUrlResponse,
)
from app.shared.errors import bad_request, not_found

router = APIRouter(prefix="/files", tags=["文件"])


def _to_item(file: File) -> FileItem:
    return FileItem(
        id=file.id,
        original_name=file.original_name,
        content_type=file.content_type,
        size_bytes=file.size_bytes,
        has_thumb=file.has_thumb,
        thumb_url=file_service.thumb_url(file),
        preview_url=file_service.preview_url(file),
        created_at=file.created_at,
    )


def _to_detail(file: File) -> FileDetail:
    return FileDetail(
        **_to_item(file).model_dump(),
        session_id=file.session_id,
        status=file.status,
        download_url=file_service.download_url(file),
    )


@router.post(
    "/upload-url",
    response_model=UploadUrlResponse,
    status_code=status.HTTP_201_CREATED,
    summary="申请直传地址",
)
async def create_upload_url(
    payload: UploadUrlRequest,
    session: SessionDep,
    current_user: CurrentUser,
) -> UploadUrlResponse:
    try:
        ticket = await file_service.request_upload(
            session,
            user_id=current_user.id,
            session_id=payload.session_id,
            filename=payload.filename,
            size_bytes=payload.size_bytes,
        )
    except file_service.SessionNotFoundError as exc:
        raise not_found() from exc
    except (file_service.UnsupportedFileTypeError, file_service.FileTooLargeError) as exc:
        raise bad_request() from exc
    return UploadUrlResponse(
        file_id=ticket.file_id,
        upload_url=ticket.upload_url,
        headers=ticket.headers,
        thumb_upload_url=ticket.thumb_upload_url,
        expires_in=ticket.expires_in,
    )


@router.post("/{file_id}/complete", response_model=FileDetail, summary="确认上传完成")
async def complete_upload(
    file_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> FileDetail:
    try:
        file = await file_service.complete_upload(session, user_id=current_user.id, file_id=file_id)
    except file_service.AttachmentNotFoundError as exc:
        raise not_found() from exc
    except file_service.UploadIncompleteError as exc:
        raise bad_request() from exc
    return _to_detail(file)


@router.get("", response_model=FileListResponse, summary="会话附件列表")
async def list_files(
    session: SessionDep,
    current_user: CurrentUser,
    session_id: uuid.UUID,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> FileListResponse:
    try:
        files, total = await file_service.list_files(
            session,
            user_id=current_user.id,
            session_id=session_id,
            limit=limit,
            offset=offset,
        )
    except file_service.SessionNotFoundError as exc:
        raise not_found() from exc
    return FileListResponse(items=[_to_item(file) for file in files], total=total)


@router.get("/{file_id}", response_model=FileDetail, summary="附件详情")
async def get_file(
    file_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> FileDetail:
    try:
        file = await file_service.get_file(session, user_id=current_user.id, file_id=file_id)
    except file_service.AttachmentNotFoundError as exc:
        raise not_found() from exc
    return _to_detail(file)


@router.get("/{file_id}/raw", summary="图片稳定访问地址")
async def raw_file(
    file_id: uuid.UUID,
    token: Annotated[str, Query(min_length=1)],
    session: SessionDep,
) -> RedirectResponse:
    if not file_service.verify_raw_token(file_id, token):
        raise not_found()
    try:
        file = await file_service.get_ready_file(session, file_id=file_id)
    except file_service.AttachmentNotFoundError as exc:
        raise not_found() from exc
    return RedirectResponse(
        url=file_service.preview_url(file),
        status_code=status.HTTP_302_FOUND,
        headers={"Cache-Control": "no-store"},
    )
