import uuid

from pydantic import BaseModel

from app.repositories.models import QuestionType

USER_ID_HEADER = "X-User-ID"


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
