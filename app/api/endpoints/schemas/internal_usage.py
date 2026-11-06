import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ReplyUsageReport(BaseModel):
    session_id: uuid.UUID
    reply_id: str = Field(min_length=1, max_length=64)
    input_tokens: int = Field(default=0, ge=0)
    output_tokens: int = Field(default=0, ge=0)
    cache_input_tokens: int = Field(default=0, ge=0)
    cache_creation_input_tokens: int = Field(default=0, ge=0)
    started_at: datetime | None = None
