from enum import StrEnum

from pydantic import BaseModel


class QuizQuestionType(StrEnum):
    SINGLE_CHOICE = "single_choice"
    SHORT_ANSWER = "short_answer"


class QuizStudentQuestion(BaseModel):
    question_type: QuizQuestionType
    stem: str
    options: list[str] | None = None
    correct_option: str | None = None
    reference_answer: str | None = None


class QuizStudentAnswer(BaseModel):
    answer: str
    question: QuizStudentQuestion
