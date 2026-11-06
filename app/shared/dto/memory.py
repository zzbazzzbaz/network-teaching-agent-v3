import uuid
from typing import Literal

from pydantic import AwareDatetime, BaseModel


class MemoryEntryDTO(BaseModel):
    id: str
    kind: Literal["daily", "digest"]
    title: str
    summary: str
    date: str | None
    session_id: uuid.UUID | None
    session_title: str | None = None
    updated_at: AwareDatetime


class MemoryEntryDetailDTO(BaseModel):
    id: str
    kind: Literal["daily", "digest"]
    title: str
    summary: str
    date: str | None
    session_id: uuid.UUID | None
    session_title: str | None = None
    updated_at: AwareDatetime
    content: str
    content_truncated: bool


class MemoryEntryListDTO(BaseModel):
    items: list[MemoryEntryDTO]
    total: int
    has_more: bool
    truncated: bool
