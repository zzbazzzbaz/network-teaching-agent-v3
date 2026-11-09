import uuid
from datetime import datetime
from enum import StrEnum
from typing import NamedTuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement
from sqlmodel import col

from app.api.repositories.models import (
    ChatRound,
    ChatSession,
    Question,
    ReplyUsage,
    User,
    UserRole,
    UserStatus,
)


class AdminUserSort(StrEnum):
    CREATED_AT_DESC = "created_at_desc"
    LAST_ACTIVE_DESC = "last_active_desc"
    USERNAME_ASC = "username_asc"
    TOKENS_DESC = "tokens_desc"
    ROUNDS_DESC = "rounds_desc"
    ANSWERS_DESC = "answers_desc"
    SESSIONS_DESC = "sessions_desc"


class AdminUserRow(NamedTuple):
    user: User
    sessions: int
    rounds: int
    tokens: int
    answers: int
    last_active_at: datetime | None


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _tokens_subquery():
    return (
        select(
            col(ReplyUsage.user_id).label("user_id"),
            func.coalesce(
                func.sum(ReplyUsage.input_tokens + ReplyUsage.output_tokens),
                0,
            ).label("tokens"),
        )
        .group_by(col(ReplyUsage.user_id))
        .subquery()
    )


def _rounds_subquery():
    return (
        select(
            col(ChatRound.user_id).label("user_id"),
            func.count().label("rounds"),
            func.max(col(ChatRound.created_at)).label("last_active_at"),
        )
        .group_by(col(ChatRound.user_id))
        .subquery()
    )


def _answers_subquery():
    return (
        select(
            col(Question.user_id).label("user_id"),
            func.count().label("answers"),
        )
        .group_by(col(Question.user_id))
        .subquery()
    )


def _sessions_subquery():
    return (
        select(
            col(ChatSession.user_id).label("user_id"),
            func.count().label("sessions"),
        )
        .where(
            col(ChatSession.deleted_at).is_(None),
            col(ChatSession.last_message_at).is_not(None),
        )
        .group_by(col(ChatSession.user_id))
        .subquery()
    )


def _admin_filters(
    query: str | None,
    role: UserRole | None,
    status: UserStatus | None,
) -> list[ColumnElement[bool]]:
    filters: list[ColumnElement[bool]] = []
    if query:
        filters.append(col(User.username).ilike(f"%{_escape_like(query)}%", escape="\\"))
    if role is not None:
        filters.append(col(User.role) == role)
    if status is not None:
        filters.append(col(User.status) == status)
    return filters


def _order_clause(sort: AdminUserSort, tokens, rounds, answers, sessions, last_active_at):
    if sort is AdminUserSort.USERNAME_ASC:
        return (col(User.username).asc(), col(User.id))
    if sort is AdminUserSort.LAST_ACTIVE_DESC:
        return (last_active_at.desc().nullslast(), col(User.username).asc(), col(User.id))
    if sort is AdminUserSort.TOKENS_DESC:
        return (tokens.desc(), col(User.username).asc(), col(User.id))
    if sort is AdminUserSort.ROUNDS_DESC:
        return (rounds.desc(), col(User.username).asc(), col(User.id))
    if sort is AdminUserSort.ANSWERS_DESC:
        return (answers.desc(), col(User.username).asc(), col(User.id))
    if sort is AdminUserSort.SESSIONS_DESC:
        return (sessions.desc(), col(User.username).asc(), col(User.id))
    return (col(User.created_at).desc(), col(User.username).asc(), col(User.id))


async def get_by_username(session: AsyncSession, username: str) -> User | None:
    result = await session.execute(select(User).where(col(User.username) == username))
    return result.scalar_one_or_none()


async def get_by_id(session: AsyncSession, user_id: uuid.UUID) -> User | None:
    return await session.get(User, user_id)


async def create(
    session: AsyncSession,
    *,
    username: str,
    password_hash: str,
    role: UserRole = UserRole.STUDENT,
    status: UserStatus = UserStatus.ACTIVE,
) -> User:
    user = User(
        username=username,
        password_hash=password_hash,
        role=role,
        status=status,
    )
    session.add(user)
    await session.flush()
    return user


async def list_admin_users(
    session: AsyncSession,
    *,
    query: str | None,
    role: UserRole | None,
    status: UserStatus | None,
    sort: AdminUserSort,
    limit: int,
    offset: int,
) -> tuple[list[AdminUserRow], int]:
    filters = _admin_filters(query, role, status)
    total = await session.scalar(select(func.count()).select_from(User).where(*filters))

    tokens_sq = _tokens_subquery()
    rounds_sq = _rounds_subquery()
    answers_sq = _answers_subquery()
    sessions_sq = _sessions_subquery()

    tokens = func.coalesce(tokens_sq.c.tokens, 0).label("tokens")
    rounds = func.coalesce(rounds_sq.c.rounds, 0).label("rounds")
    answers = func.coalesce(answers_sq.c.answers, 0).label("answers")
    sessions = func.coalesce(sessions_sq.c.sessions, 0).label("sessions")
    last_active_at = rounds_sq.c.last_active_at.label("last_active_at")

    statement = (
        select(User, sessions, rounds, tokens, answers, last_active_at)
        .outerjoin(tokens_sq, tokens_sq.c.user_id == col(User.id))
        .outerjoin(rounds_sq, rounds_sq.c.user_id == col(User.id))
        .outerjoin(answers_sq, answers_sq.c.user_id == col(User.id))
        .outerjoin(sessions_sq, sessions_sq.c.user_id == col(User.id))
        .where(*filters)
        .order_by(*_order_clause(sort, tokens, rounds, answers, sessions, last_active_at))
        .limit(limit)
        .offset(offset)
    )
    rows = (await session.execute(statement)).all()
    items = [
        AdminUserRow(
            user=row[0],
            sessions=int(row[1]),
            rounds=int(row[2]),
            tokens=int(row[3]),
            answers=int(row[4]),
            last_active_at=row[5],
        )
        for row in rows
    ]
    return items, int(total or 0)


async def last_active_at(session: AsyncSession, *, user_id: uuid.UUID) -> datetime | None:
    statement = select(func.max(col(ChatRound.created_at))).where(
        col(ChatRound.user_id) == user_id
    )
    return await session.scalar(statement)


async def count_active_admins(
    session: AsyncSession,
    *,
    exclude_user_id: uuid.UUID | None = None,
) -> int:
    filters: list[ColumnElement[bool]] = [
        col(User.role) == UserRole.ADMIN,
        col(User.status) == UserStatus.ACTIVE,
    ]
    if exclude_user_id is not None:
        filters.append(col(User.id) != exclude_user_id)
    total = await session.scalar(select(func.count()).select_from(User).where(*filters))
    return int(total or 0)


async def update_user(
    session: AsyncSession,
    user: User,
    *,
    username: str | None = None,
    role: UserRole | None = None,
    status: UserStatus | None = None,
) -> User:
    if username is not None:
        user.username = username
    if role is not None:
        user.role = role
    if status is not None:
        user.status = status
    session.add(user)
    await session.flush()
    return user


async def set_password(session: AsyncSession, user: User, password_hash: str) -> None:
    user.password_hash = password_hash
    session.add(user)
    await session.flush()
