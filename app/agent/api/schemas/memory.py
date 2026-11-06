from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class MemoryEntryItem(BaseModel):
    id: str
    kind: Literal["daily", "digest"]
    title: str
    summary: str
    date: str | None
    session_id: str | None
    updated_at: datetime


class MemoryEntryDetail(MemoryEntryItem):
    content: str
    content_truncated: bool


class MemoryEntryListResponse(BaseModel):
    items: list[MemoryEntryItem]
    total: int
    has_more: bool
    truncated: bool
