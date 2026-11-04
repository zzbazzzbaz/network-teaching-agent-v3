import uuid
from datetime import datetime
from typing import Any, Self

from pydantic import BaseModel, Field, HttpUrl, model_validator

from app.repositories.models import AgentKind


class SessionItem(BaseModel):
    id: uuid.UUID
    agent_kind: AgentKind
    title: str
    last_message_at: datetime | None
    created_at: datetime


class SessionListResponse(BaseModel):
    items: list[SessionItem]
    total: int


class RenameSessionRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)


class MessageAttachment(BaseModel):
    file_id: uuid.UUID | None = None
    url: HttpUrl | None = None
    media_type: str | None = Field(default=None, max_length=128)
    name: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def _check_source(self) -> Self:
        if (self.file_id is None) == (self.url is None):
            raise ValueError("file_id 和 url 必须二选一")
        if self.url is not None and not self.media_type:
            raise ValueError("url 附件必须提供 media_type")
        return self


class SendMessageRequest(BaseModel):
    text: str = Field(default="", max_length=20000)
    attachments: list[MessageAttachment] = Field(default_factory=list, max_length=4)


class SendMessageResponse(BaseModel):
    status: str
    session_id: uuid.UUID


class MessageListResponse(BaseModel):
    messages: list[dict[str, Any]]
    event_cursor: str | None = None
    is_running: bool
    has_more: bool


class InterruptResponse(BaseModel):
    session_id: uuid.UUID


class SessionStatusResponse(BaseModel):
    session_id: uuid.UUID
    status: str
