import uuid

from pydantic import AwareDatetime, BaseModel, ConfigDict

from app.shared.enums import QuestionType


class QuestionRecordItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    question_type: QuestionType
    stem: str
    student_answer: str
    correct_answer: str
    session_id: uuid.UUID
    answered_at: AwareDatetime


class QuestionRecordDetail(QuestionRecordItem):
    options: dict[str, str] | None = None


class QuestionRecordListResponse(BaseModel):
    items: list[QuestionRecordItem]
    total: int
