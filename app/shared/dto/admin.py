import uuid
from datetime import date
from typing import Annotated

from pydantic import AwareDatetime, BaseModel, Field, StringConstraints

from app.shared.enums import QuestionType, UserRole, UserStatus

AdminUsername = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        min_length=3,
        max_length=64,
        pattern=r"^\S+$",
    ),
]


class AdminUserItem(BaseModel):
    id: uuid.UUID
    username: str
    role: UserRole
    status: UserStatus
    created_at: AwareDatetime
    last_active_at: AwareDatetime | None
    sessions: int
    rounds: int
    tokens: int
    answers: int


class AdminUserListResponse(BaseModel):
    items: list[AdminUserItem]
    total: int


class AdminUserCreateRequest(BaseModel):
    username: AdminUsername
    password: str = Field(min_length=6, max_length=128)
    role: UserRole = UserRole.STUDENT
    status: UserStatus = UserStatus.ACTIVE


class AdminUserStatusRequest(BaseModel):
    status: UserStatus


class AdminPasswordResetRequest(BaseModel):
    new_password: str = Field(min_length=6, max_length=128)


class AdminUserDetail(BaseModel):
    id: uuid.UUID
    username: str
    role: UserRole
    status: UserStatus
    created_at: AwareDatetime
    last_active_at: AwareDatetime | None


class AdminOverviewDailyItem(BaseModel):
    date: date
    tokens: int
    input_tokens: int
    output_tokens: int
    cache_input_tokens: int
    cache_hit_rate: float | None
    rounds: int
    answers: int
    active_students: int
    new_students: int


class AdminOverviewResponse(BaseModel):
    students_total: int
    students_active: int
    students_new: int
    sessions: int
    rounds: int
    answers: int
    tokens: int
    input_tokens: int
    output_tokens: int
    cache_input_tokens: int
    cache_hit_rate: float | None
    daily: list[AdminOverviewDailyItem]


class AdminUserRankingItem(BaseModel):
    user_id: uuid.UUID
    username: str
    tokens: int
    rounds: int
    answers: int
    sessions: int
    last_active_at: AwareDatetime | None


class AdminUserRankingResponse(BaseModel):
    items: list[AdminUserRankingItem]


class AdminQuestionItem(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID | None
    owner_username: str | None
    is_public: bool
    stem: str
    question_type: QuestionType
    options: dict[str, str] | None
    answer_text: str
    note: str | None
    created_at: AwareDatetime
    attempt_count: int
    student_count: int


class AdminQuestionListResponse(BaseModel):
    items: list[AdminQuestionItem]
    total: int


class AdminQuestionDetail(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID | None
    owner_username: str | None
    is_public: bool
    stem: str
    question_type: QuestionType
    options: dict[str, str] | None
    answer_text: str
    note: str | None
    created_at: AwareDatetime
    attempt_total: int
    student_count: int


class AdminQuestionCreateRequest(BaseModel):
    stem: str = Field(min_length=1, max_length=5000)
    question_type: QuestionType
    options: dict[str, str] | None = None
    answer_text: str = Field(min_length=1, max_length=5000)
    note: str | None = Field(default=None, max_length=2000)


class AdminQuestionUpdateRequest(BaseModel):
    stem: str | None = Field(default=None, min_length=1, max_length=5000)
    question_type: QuestionType | None = None
    options: dict[str, str] | None = None
    answer_text: str | None = Field(default=None, min_length=1, max_length=5000)
    note: str | None = Field(default=None, max_length=2000)


class AdminAttemptItem(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    username: str
    answer_text: str
    created_at: AwareDatetime
    session_id: uuid.UUID
    session_title: str | None


class AdminAttemptListResponse(BaseModel):
    items: list[AdminAttemptItem]
    total: int
