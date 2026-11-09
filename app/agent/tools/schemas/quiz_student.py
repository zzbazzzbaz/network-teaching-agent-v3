from typing import Any

from pydantic import BaseModel, Field


class QuizStudentAnswer(BaseModel):
    answer: str = Field(
        description="学生提交的答案; 单选为选项字母, 简答为作答文本。",
    )
    question: dict[str, Any] = Field(
        description="被作答的原题, 用于回写答题记录。",
    )
