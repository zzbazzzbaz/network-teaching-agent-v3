import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.repositories.models import FileStatus


class UploadUrlRequest(BaseModel):
    session_id: uuid.UUID
    filename: str = Field(min_length=1, max_length=255)
    size_bytes: int = Field(gt=0)


class UploadUrlResponse(BaseModel):
    file_id: uuid.UUID
    upload_url: str
    method: str = "PUT"
    headers: dict[str, str]
    thumb_upload_url: str | None
    expires_in: int


class FileItem(BaseModel):
    id: uuid.UUID
    original_name: str
    content_type: str
    size_bytes: int
    has_thumb: bool
    thumb_url: str | None
    preview_url: str
    created_at: datetime


class FileDetail(FileItem):
    session_id: uuid.UUID
    status: FileStatus
    download_url: str


class FileListResponse(BaseModel):
    items: list[FileItem]
    total: int
