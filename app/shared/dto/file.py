import uuid

from pydantic import BaseModel, Field

from app.shared.enums import FileStatus


class UploadUrlRequest(BaseModel):
    session_id: uuid.UUID
    filename: str = Field(min_length=1, max_length=255)
    size_bytes: int = Field(gt=0)


class UploadUrlResponse(BaseModel):
    file_id: uuid.UUID
    upload_url: str
    method: str = "PUT"
    headers: dict[str, str]
    expires_in: int


class UploadCompletedResponse(BaseModel):
    file_id: uuid.UUID
    url: str
    status: FileStatus
