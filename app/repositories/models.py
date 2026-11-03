import uuid
from datetime import UTC, datetime

from enum import StrEnum
from sqlmodel import Field, SQLModel


class UserStatus(StrEnum):
    ACTIVE = "active"
    DISABLED = "disabled"


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    username: str = Field(max_length=64, unique=True, index=True)
    password_hash: str = Field(max_length=255)
    status: UserStatus = Field(default=UserStatus.ACTIVE)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class Session(BaseModel):
    __tablename__ = "sessions"
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    user_id
    agent_id:Enum("teach_agent","exp_agent")
    title
    last_message_at
    created_at
    deleted_at


class file:
    __tablename__ = "files"
    id
    session_id
    original_name
    storage_key
    created_at
    deleted_at

class quesion:
    id
    user_id # 如果是null就是公开的题
    stem:text # 题目（可能包含markdown文本）
    type:Enum # 单选 简答
    options：JSON # 单选题选项 或 简答题输入框提示文本
    answer_text：str # A、B、C、D文本 或 简答题参考答案
    note # 备注

class question_作答记录：
    id
    user_id
    question_id
    session_id
    tool_call_id
    answer_text # 当时学生的输入