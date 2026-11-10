from typing import Literal

from pydantic import AwareDatetime, BaseModel, Field

KnowledgeVisibility = Literal["private", "public"]
KnowledgeDocumentStatus = Literal[
    "pending",
    "parsing",
    "chunking",
    "indexing",
    "ready",
    "error",
]


class KnowledgeStatusCounts(BaseModel):
    pending: int = 0
    parsing: int = 0
    chunking: int = 0
    indexing: int = 0
    ready: int = 0
    error: int = 0


class KnowledgeBaseItem(BaseModel):
    id: str
    name: str
    description: str = ""
    visibility: KnowledgeVisibility
    editable: bool
    document_count: int = 0
    chunk_count: int = 0
    status_counts: KnowledgeStatusCounts = Field(default_factory=KnowledgeStatusCounts)
    created_at: AwareDatetime
    updated_at: AwareDatetime


class KnowledgeBaseListResponse(BaseModel):
    items: list[KnowledgeBaseItem]
    total: int


class KnowledgeBaseCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)


class KnowledgeBaseUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)


class KnowledgeDocumentItem(BaseModel):
    id: str
    filename: str
    size: int
    content_type: str | None = None
    status: KnowledgeDocumentStatus
    error: str | None = None
    chunk_count: int = 0
    created_at: AwareDatetime
    updated_at: AwareDatetime


class KnowledgeDocumentListResponse(BaseModel):
    items: list[KnowledgeDocumentItem]
    total: int


class KnowledgeDocumentStatusResponse(BaseModel):
    items: list[KnowledgeDocumentItem]


class KnowledgeDocumentUploadResponse(BaseModel):
    id: str
    filename: str
    status: KnowledgeDocumentStatus


class KnowledgeDocumentUploadUrlRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    size_bytes: int = Field(gt=0)


class KnowledgeDocumentUploadUrlResponse(BaseModel):
    upload_id: str
    upload_url: str
    method: str = "PUT"
    headers: dict[str, str]
    expires_in: int


class KnowledgeDocumentCompleteRequest(BaseModel):
    upload_id: str = Field(min_length=1, max_length=64)
    filename: str = Field(min_length=1, max_length=255)
    size_bytes: int = Field(gt=0)
    content_type: str | None = None


class KnowledgeDocumentDownloadUrlResponse(BaseModel):
    url: str
    filename: str
    expires_in: int


class KnowledgeSupportedContentTypesResponse(BaseModel):
    extensions: list[str]
    media_types: list[str]
