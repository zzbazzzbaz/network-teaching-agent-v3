import uuid
from typing import Any

from pydantic import BaseModel, Field, model_validator

from app.shared.enums import QuestionType

_LETTERS = "ABCDEF"


class QuestionPayload(BaseModel):
    question_type: QuestionType = Field(
        description=(
            "题型: `single_choice` 为单选, 必须给 options 和 correct_option; "
            "`short_answer` 为简答, 必须给 reference_answer。"
        ),
    )
    stem: str = Field(
        min_length=1,
        max_length=5000,
        description=(
            "完整题干, 可以用 Markdown; 学生只看这张卡片, 所以题干要自包含, "
            "不要用「上题」「刚才」指代对话前文, 也不要把选项字母和内容写进题干。"
        ),
    )
    options: list[str] | None = Field(
        default=None,
        max_length=6,
        description=(
            "仅单选题: 2-6 个选项的文字列表, 按顺序自动对应 A/B/C/D/E/F; "
            "每项只写选项内容, 不要带 `A.` `B.` 之类的前缀。简答题传 null。"
        ),
    )
    correct_option: str | None = Field(
        default=None,
        description=(
            "仅单选题: 正确选项的字母, 取 `A`-`F` 中的一个大写字母, "
            "必须与 options 中的位置对应。简答题传 null。"
        ),
    )
    reference_answer: str | None = Field(
        default=None,
        max_length=5000,
        description=(
            "仅简答题: 标准答案或得分要点, 用于判分和讲解, 不会展示给学生。单选题传 null。"
        ),
    )

    @model_validator(mode="after")
    def _validate_question(self) -> QuestionPayload:
        stem = self.stem.strip()
        if not stem:
            raise ValueError("题干不能为空")
        self.stem = stem

        if self.question_type is QuestionType.SINGLE_CHOICE:
            if not self.options or not 2 <= len(self.options) <= 6:
                raise ValueError("单选题必须提供 2-6 个选项")
            normalized_options: list[str] = []
            for option in self.options:
                text = option.strip()
                if not text:
                    raise ValueError("选项内容不能为空")
                normalized_options.append(text)
            self.options = normalized_options
            if self.reference_answer is not None:
                raise ValueError("单选题不能提供简答题参考答案")
            if self.correct_option is None:
                raise ValueError("单选题必须提供正确选项")
            correct_option = self.correct_option.strip().upper()
            if correct_option not in _LETTERS[: len(normalized_options)]:
                raise ValueError("单选题答案必须是选项之一")
            self.correct_option = correct_option
            return self

        if self.options is not None:
            raise ValueError("简答题不能包含选项")
        if self.correct_option is not None:
            raise ValueError("简答题不能提供正确选项")
        if self.reference_answer is None or not self.reference_answer.strip():
            raise ValueError("简答题必须提供参考答案")
        self.reference_answer = self.reference_answer.strip()
        return self


class AnswerWriteRequest(BaseModel):
    session_id: uuid.UUID
    tool_call_id: str
    question: QuestionPayload
    answer: str


class AnswerRelayRequest(BaseModel):
    session_id: uuid.UUID
    tool_call_id: str
    question: dict[str, Any]
    answer: str
