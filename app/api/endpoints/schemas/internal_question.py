import uuid

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.repositories.models import QuestionType

USER_ID_HEADER = "X-User-ID"
"""内部接口用这个头标识调用者, 仅信任 agent 进程的内网调用。"""

_LETTERS = "ABCDEF"


class QuestionPayload(BaseModel):
    """一道题的完整内容, 参考答案也在其中。"""

    model_config = ConfigDict(str_strip_whitespace=True)

    question_type: QuestionType = Field(
        description="single_choice 为单选题; short_answer 为简答题。",
    )
    stem: str = Field(
        min_length=1,
        max_length=4000,
        description="题干, 支持 Markdown。",
    )
    options: list[str] | None = Field(
        default=None,
        min_length=2,
        max_length=6,
        description=(
            "单选题选项, 2-6 个纯文本, 不要自带 A./B. 字母; 界面会按顺序显示 A、B、C…。简答题省略。"
        ),
    )
    correct_option: str | None = Field(
        default=None,
        min_length=1,
        max_length=1,
        description="单选题正确选项字母 (A-F); 简答题省略。",
    )
    reference_answer: str | None = Field(
        default=None,
        min_length=1,
        max_length=8000,
        description="简答题参考答案; 单选题省略, 正确选项即答案。",
    )

    @field_validator("correct_option", mode="before")
    @classmethod
    def _normalize_letter(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().upper() or None
        return value

    @field_validator("options")
    @classmethod
    def _normalize_options(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        cleaned = [option.strip() for option in value]
        if any(not option for option in cleaned):
            raise ValueError("选项内容不能为空")
        if len(set(cleaned)) != len(cleaned):
            raise ValueError("选项内容不能重复")
        return cleaned

    @model_validator(mode="after")
    def _validate_shape(self) -> QuestionPayload:
        if self.question_type is QuestionType.SINGLE_CHOICE:
            if self.options is None or not 2 <= len(self.options) <= 6:
                raise ValueError("单选题必须提供 2-6 个选项")
            if self.correct_option not in set(_LETTERS[: len(self.options)]):
                raise ValueError("单选题的 correct_option 必须是 A-F 且不超过选项数量")
            if self.reference_answer is not None:
                raise ValueError("单选题不需要 reference_answer")
        else:
            if self.options is not None:
                raise ValueError("简答题不能提供 options")
            if self.correct_option is not None:
                raise ValueError("简答题不能提供 correct_option")
            if self.reference_answer is None:
                raise ValueError("简答题必须提供 reference_answer")
        return self

    @property
    def options_map(self) -> dict[str, str] | None:
        """题库按 ``{"A": "选项内容"}`` 存选项。"""
        if self.options is None:
            return None
        return dict(zip(_LETTERS, self.options, strict=False))

    @property
    def answer_text(self) -> str:
        """题库 ``Question.answer_text`` 的取值: 统一成一个参考答案字段。"""
        if self.question_type is QuestionType.SINGLE_CHOICE:
            assert self.correct_option is not None
            return self.correct_option
        assert self.reference_answer is not None
        return self.reference_answer


class AnswerWriteRequest(BaseModel):
    """agent 回写一次「出题 + 作答」。"""

    model_config = ConfigDict(str_strip_whitespace=True)

    session_id: uuid.UUID = Field(description="会话 ID, 对应 sessions.id。")
    tool_call_id: str = Field(
        min_length=1,
        max_length=128,
        description="产生这道题的工具调用 ID, 用于重放时幂等。",
    )
    question: QuestionPayload
    answer: str = Field(
        min_length=1,
        max_length=2000,
        description='学生答案。单选题传字母, 例如 "B"; 简答题传文本。',
    )
