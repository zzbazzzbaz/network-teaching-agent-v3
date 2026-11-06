from pydantic import BaseModel

from app.shared.enums import QuestionType


class QuizStudentQuestion(BaseModel):
    question_type: QuestionType
    stem: str
    options: list[str] | None = None
    correct_option: str | None = None
    reference_answer: str | None = None


class QuizStudentAnswer(BaseModel):
    answer: str
    question: QuizStudentQuestion
