import uuid
from datetime import date
from typing import Annotated

from pydantic import AwareDatetime, BaseModel, ConfigDict, StringConstraints

from app.shared.enums import UserRole, UserStatus

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
    model_config = ConfigDict(extra="forbid")

    username: AdminUsername
    status: UserStatus = UserStatus.ACTIVE


class AdminUserStatusRequest(BaseModel):
    status: UserStatus


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
