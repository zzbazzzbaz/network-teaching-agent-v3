import uuid
from datetime import datetime

from pydantic import BaseModel

from app.shared.enums import QuestionType


class QuestionPayload(BaseModel):
    question_type: QuestionType
    stem: str
    options: list[str] | None = None
    correct_option: str | None = None
    reference_answer: str | None = None


class AnswerWriteRequest(BaseModel):
    session_id: uuid.UUID
    tool_call_id: str
    question: QuestionPayload
    answer: str


class AttemptItem(BaseModel):
    answer_text: str
    created_at: datetime


class QuestionDetailResponse(BaseModel):
    id: uuid.UUID
    question_type: QuestionType
    stem: str
    options: dict[str, str] | None = None
    answer_text: str
    note: str | None = None
    created_at: datetime
    attempts: list[AttemptItem]
    attempt_total: int
