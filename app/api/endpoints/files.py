import uuid

from fastapi import APIRouter, status

from app.api.dependencies import CurrentUser, SessionDep
from app.api.services import file_service
from app.shared.dto.file import (
    UploadCompletedResponse,
    UploadUrlRequest,
    UploadUrlResponse,
)
from app.shared.errors import bad_request, not_found

router = APIRouter(prefix="/files", tags=["文件"])


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
        expires_in=ticket.expires_in,
    )


@router.post(
    "/{file_id}/complete",
    response_model=UploadCompletedResponse,
    summary="确认上传完成",
)
async def complete_upload(
    file_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> UploadCompletedResponse:
    try:
        file = await file_service.complete_upload(session, user_id=current_user.id, file_id=file_id)
    except file_service.AttachmentNotFoundError as exc:
        raise not_found() from exc
    except file_service.UploadIncompleteError as exc:
        raise bad_request() from exc
    return UploadCompletedResponse(
        file_id=file.id,
        url=file_service.public_url(file),
        status=file.status,
    )
