import uuid

from pydantic import BaseModel


class GetQuestionInput(BaseModel):
    question_id: uuid.UUID
    attempt_limit: int = 5
