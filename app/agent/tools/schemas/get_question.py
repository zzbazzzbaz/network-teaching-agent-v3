import uuid

from pydantic import BaseModel, Field


class GetQuestionInput(BaseModel):
    question_id: uuid.UUID = Field(
        description=(
            "题库中的题目 UUID, 必须是学生给出的完整 ID, "
            "或此前工具结果里出现过的 ID; 不要猜测、截断或自行构造。"
        ),
    )
    attempt_limit: int = Field(
        default=5,
        ge=1,
        le=20,
        description=(
            "返回最近多少次作答记录, 取值 1-20, 默认 5; "
            "需要看长期历史时调大, 只看最近一次时设为 1。"
        ),
    )
