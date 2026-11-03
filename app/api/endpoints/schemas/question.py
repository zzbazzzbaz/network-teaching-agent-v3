import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.repositories.models import QuestionType


class QuestionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID | None
    stem: str
    question_type: QuestionType
    options: dict[str, str] | None
    answer_text: str
    note: str | None
    created_at: datetime


class QuestionListResponse(BaseModel):
    items: list[QuestionResponse]
    total: int


class AttemptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    question_id: uuid.UUID
    session_id: uuid.UUID
    tool_call_id: str | None
    answer_text: str
    created_at: datetime


class AttemptListResponse(BaseModel):
    items: list[AttemptResponse]
    total: int
