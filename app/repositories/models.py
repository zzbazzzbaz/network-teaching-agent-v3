import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Column, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


def _now() -> datetime:
    return datetime.now(UTC)


class UserStatus(StrEnum):
    ACTIVE = "active"
    DISABLED = "disabled"


class AgentKind(StrEnum):
    TEACH = "teach_agent"
    EXP = "exp_agent"


class QuestionType(StrEnum):
    SINGLE_CHOICE = "single_choice"
    SHORT_ANSWER = "short_answer"


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    username: str = Field(max_length=64, unique=True, index=True)
    password_hash: str = Field(max_length=255)
    status: UserStatus = Field(default=UserStatus.ACTIVE)
    created_at: datetime = Field(default_factory=_now)


class ChatSession(SQLModel, table=True):
    __tablename__ = "sessions"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    agent_kind: AgentKind = Field(default=AgentKind.TEACH)
    title: str | None = Field(default=None, max_length=255)
    last_message_at: datetime | None = Field(default=None)
    created_at: datetime = Field(default_factory=_now)
    deleted_at: datetime | None = Field(default=None)


class File(SQLModel, table=True):
    __tablename__ = "files"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    session_id: uuid.UUID = Field(foreign_key="sessions.id", index=True)
    original_name: str = Field(max_length=255)
    storage_key: str = Field(max_length=512, unique=True)
    created_at: datetime = Field(default_factory=_now)
    deleted_at: datetime | None = Field(default=None)


class Question(SQLModel, table=True):
    __tablename__ = "questions"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID | None = Field(default=None, foreign_key="users.id", index=True)
    stem: str = Field(sa_column=Column(Text, nullable=False))
    question_type: QuestionType
    options: dict[str, str] | None = Field(default=None, sa_column=Column(JSONB, nullable=True))
    answer_text: str = Field(sa_column=Column(Text, nullable=False))
    note: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    created_at: datetime = Field(default_factory=_now)
    deleted_at: datetime | None = Field(default=None)


class QuestionAttempt(SQLModel, table=True):
    __tablename__ = "question_attempts"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    question_id: uuid.UUID = Field(foreign_key="questions.id", index=True)
    session_id: uuid.UUID = Field(foreign_key="sessions.id", index=True)
    tool_call_id: str | None = Field(default=None, max_length=128, index=True)
    answer_text: str = Field(sa_column=Column(Text, nullable=False))
    created_at: datetime = Field(default_factory=_now)
