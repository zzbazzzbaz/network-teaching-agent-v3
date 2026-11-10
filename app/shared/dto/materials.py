import uuid
from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from app.shared.enums import MaterialCollectionKind

MaterialNodeKind = Literal["folder", "document"]


class MaterialCollectionItem(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    kind: MaterialCollectionKind
    description: str
    sort_order: int


class MaterialNodeSummary(BaseModel):
    id: uuid.UUID
    parent_id: uuid.UUID | None
    kind: MaterialNodeKind
    name: str
    title: str
    path: str
    sort_order: int
    children: list[MaterialNodeSummary] = []


class MaterialCollectionTree(MaterialCollectionItem):
    children: list[MaterialNodeSummary] = []


class MaterialTreeResponse(BaseModel):
    items: list[MaterialCollectionTree]


class MaterialCollectionListResponse(BaseModel):
    items: list[MaterialCollectionItem]


class MaterialNodeRef(BaseModel):
    id: uuid.UUID
    title: str
    path: str


class MaterialBreadcrumb(BaseModel):
    id: uuid.UUID
    title: str
    kind: Literal["collection", "folder"]


class MaterialImageAsset(BaseModel):
    file_id: uuid.UUID
    name: str
    content_type: str
    url: str


class MaterialNodeDetail(BaseModel):
    id: uuid.UUID
    collection_id: uuid.UUID
    parent_id: uuid.UUID | None
    kind: MaterialNodeKind
    name: str
    title: str
    path: str
    sort_order: int
    content: str | None
    collection: MaterialCollectionItem
    breadcrumbs: list[MaterialBreadcrumb]
    prev: MaterialNodeRef | None
    next: MaterialNodeRef | None
    images: list[MaterialImageAsset]
    updated_at: AwareDatetime


class MaterialSearchItem(BaseModel):
    id: uuid.UUID
    title: str
    path: str
    snippet: str


class MaterialSearchResponse(BaseModel):
    items: list[MaterialSearchItem]


class MaterialCollectionCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slug: str = Field(min_length=1, max_length=128, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    title: str = Field(min_length=1, max_length=255)
    kind: MaterialCollectionKind = MaterialCollectionKind.TEXTBOOK
    description: str = Field(default="", max_length=1000)
    sort_order: int = 0


class MaterialCollectionUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    sort_order: int | None = None


class MaterialNodeCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    collection_id: uuid.UUID
    parent_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=255)
    content: str | None = None
    sort_order: int | None = None


class MaterialNodeUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=255)
    content: str | None = None
    parent_id: uuid.UUID | None = None
    sort_order: int | None = None


class MaterialNodeOrderItem(BaseModel):
    id: uuid.UUID
    sort_order: int


class MaterialNodeReorderRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[MaterialNodeOrderItem] = Field(min_length=1)


class MaterialAssetUploadUrlRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    filename: str = Field(min_length=1, max_length=255)
    size_bytes: int = Field(gt=0)


class MaterialAssetUploadUrlResponse(BaseModel):
    file_id: uuid.UUID
    upload_url: str
    headers: dict[str, str]
    expires_in: int


class MaterialAssetCompleteResponse(BaseModel):
    file_id: uuid.UUID
    url: str
    markdown: str


class InternalMaterialLsItem(BaseModel):
    id: uuid.UUID
    kind: MaterialNodeKind
    name: str
    path: str


class InternalMaterialLsResponse(BaseModel):
    path: str
    items: list[InternalMaterialLsItem]


class InternalMaterialImage(BaseModel):
    file_id: uuid.UUID
    name: str
    content_type: str
    url: str


class InternalMaterialReadResponse(BaseModel):
    id: uuid.UUID
    collection_id: uuid.UUID
    title: str
    path: str
    content: str
    images: list[InternalMaterialImage]


class InternalMaterialSearchItem(BaseModel):
    id: uuid.UUID
    path: str
    line: int
    text: str


class InternalMaterialSearchResponse(BaseModel):
    items: list[InternalMaterialSearchItem]
