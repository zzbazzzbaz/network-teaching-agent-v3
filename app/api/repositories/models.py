import uuid
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import Column, Index, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from app.shared.enums import (
    AgentKind,
    FileStatus,
    MaterialCollectionKind,
    QuestionType,
    UserRole,
    UserStatus,
)


def _now() -> datetime:
    return datetime.now(UTC)


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    username: str = Field(max_length=64, unique=True, index=True)
    password_hash: str = Field(max_length=255)
    status: UserStatus = Field(default=UserStatus.ACTIVE)
    role: UserRole = Field(default=UserRole.STUDENT, index=True)
    created_at: datetime = Field(default_factory=_now)


class ChatSession(SQLModel, table=True):
    __tablename__ = "sessions"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    agent_kind: AgentKind = Field(default=AgentKind.TEACH)
    title: str | None = Field(default=None, max_length=255)
    knowledge_base_ids: list[str] = Field(
        default_factory=list,
        sa_column=Column(JSONB, nullable=False, server_default="[]"),
    )
    last_message_at: datetime | None = Field(default=None)
    created_at: datetime = Field(default_factory=_now)
    deleted_at: datetime | None = Field(default=None)


class File(SQLModel, table=True):
    __tablename__ = "files"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    session_id: uuid.UUID | None = Field(
        default=None,
        foreign_key="sessions.id",
        index=True,
    )
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    original_name: str = Field(max_length=255)
    content_type: str = Field(max_length=128)
    size_bytes: int
    status: FileStatus = Field(default=FileStatus.PENDING)
    has_thumb: bool = Field(default=False)
    created_at: datetime = Field(default_factory=_now)
    deleted_at: datetime | None = Field(default=None)

    @property
    def storage_key(self) -> str:
        suffix = Path(self.original_name).suffix.lower()
        if len(suffix) > 10 or not suffix[1:].isalnum():
            suffix = ""
        if self.session_id is None:
            return f"materials/{self.id}{suffix}"
        return f"sessions/{self.session_id}/{self.id}{suffix}"

    @property
    def thumb_key(self) -> str:
        return f"{self.storage_key}.thumb.jpg"


class MaterialCollection(SQLModel, table=True):
    __tablename__ = "material_collections"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    slug: str = Field(max_length=128, unique=True, index=True)
    title: str = Field(max_length=255)
    kind: MaterialCollectionKind = Field(default=MaterialCollectionKind.TEXTBOOK)
    description: str = Field(default="", max_length=1000)
    sort_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)
    deleted_at: datetime | None = Field(default=None)


class MaterialNode(SQLModel, table=True):
    __tablename__ = "material_nodes"
    __table_args__ = (
        Index(
            "uq_material_nodes_parent_name_active",
            "collection_id",
            "parent_id",
            "name",
            unique=True,
            postgresql_nulls_not_distinct=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "ix_material_nodes_collection_parent_sort",
            "collection_id",
            "parent_id",
            "sort_order",
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    collection_id: uuid.UUID = Field(foreign_key="material_collections.id", index=True)
    parent_id: uuid.UUID | None = Field(
        default=None,
        foreign_key="material_nodes.id",
        index=True,
    )
    name: str = Field(max_length=255)
    content: str | None = Field(
        default=None,
        sa_column=Column(Text, nullable=True),
    )
    sort_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)
    deleted_at: datetime | None = Field(default=None)


class Question(SQLModel, table=True):
    __tablename__ = "questions"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "tool_call_id",
            name="uq_questions_user_tool_call",
        ),
        Index("ix_questions_user_answered", "user_id", "answered_at"),
        Index("ix_questions_session", "session_id"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id")
    session_id: uuid.UUID = Field(foreign_key="sessions.id")
    tool_call_id: str = Field(max_length=128)
    question_type: QuestionType
    stem: str = Field(sa_column=Column(Text, nullable=False))
    options: dict[str, str] | None = Field(default=None, sa_column=Column(JSONB, nullable=True))
    correct_answer: str = Field(sa_column=Column(Text, nullable=False))
    student_answer: str = Field(sa_column=Column(Text, nullable=False))
    answered_at: datetime = Field(default_factory=_now)


class ReplyUsage(SQLModel, table=True):
    __tablename__ = "reply_usages"
    __table_args__ = (Index("ix_reply_usages_user_started", "user_id", "started_at"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    reply_id: str = Field(max_length=64, unique=True, index=True)
    user_id: uuid.UUID = Field(foreign_key="users.id")
    session_id: uuid.UUID = Field(foreign_key="sessions.id", index=True)
    input_tokens: int = Field(default=0)
    output_tokens: int = Field(default=0)
    cache_input_tokens: int = Field(default=0)
    cache_creation_input_tokens: int = Field(default=0)
    started_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


class ChatRound(SQLModel, table=True):
    __tablename__ = "chat_rounds"
    __table_args__ = (Index("ix_chat_rounds_user_created", "user_id", "created_at"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id")
    session_id: uuid.UUID = Field(foreign_key="sessions.id", index=True)
    created_at: datetime = Field(default_factory=_now)
