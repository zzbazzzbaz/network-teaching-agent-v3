import uuid
from dataclasses import dataclass
from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import Date, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import cast, col

from app.api.repositories.models import (
    ChatRound,
    QuestionAttempt,
    ReplyUsage,
    User,
    UserRole,
)
from app.shared.constants import APP_TIMEZONE


class AdminRankingSort(StrEnum):
    TOKENS = "tokens"
    ROUNDS = "rounds"
    ANSWERS = "answers"
    SESSIONS = "sessions"


@dataclass(frozen=True)
class OverviewTotals:
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


@dataclass(frozen=True)
class DailyOverviewRow:
    date: date
    tokens: int
    input_tokens: int
    output_tokens: int
    cache_input_tokens: int
    rounds: int
    answers: int
    active_students: int
    new_students: int


@dataclass(frozen=True)
class RankingRow:
    user_id: uuid.UUID
    username: str
    tokens: int
    rounds: int
    answers: int
    sessions: int
    last_active_at: datetime | None


def _day_column(column):
    return cast(func.timezone(APP_TIMEZONE, column), Date)


def _student_join_condition(model):
    return User.id == model.user_id


async def count_students_total(session: AsyncSession) -> int:
    total = await session.scalar(
        select(func.count()).select_from(User).where(col(User.role) == UserRole.STUDENT)
    )
    return int(total or 0)


async def count_students_new(
    session: AsyncSession,
    *,
    start_at: datetime,
    end_at: datetime,
) -> int:
    statement = (
        select(func.count())
        .select_from(User)
        .where(
            col(User.role) == UserRole.STUDENT,
            col(User.created_at) >= start_at,
            col(User.created_at) < end_at,
        )
    )
    total = await session.scalar(statement)
    return int(total or 0)


async def count_rounds(
    session: AsyncSession,
    *,
    start_at: datetime,
    end_at: datetime,
) -> int:
    statement = (
        select(func.count())
        .select_from(ChatRound)
        .join(User, _student_join_condition(ChatRound))
        .where(
            col(User.role) == UserRole.STUDENT,
            col(ChatRound.created_at) >= start_at,
            col(ChatRound.created_at) < end_at,
        )
    )
    total = await session.scalar(statement)
    return int(total or 0)


async def count_active_students(
    session: AsyncSession,
    *,
    start_at: datetime,
    end_at: datetime,
) -> int:
    statement = (
        select(func.count(func.distinct(col(ChatRound.user_id))))
        .select_from(ChatRound)
        .join(User, _student_join_condition(ChatRound))
        .where(
            col(User.role) == UserRole.STUDENT,
            col(ChatRound.created_at) >= start_at,
            col(ChatRound.created_at) < end_at,
        )
    )
    total = await session.scalar(statement)
    return int(total or 0)


async def count_sessions(
    session: AsyncSession,
    *,
    start_at: datetime,
    end_at: datetime,
) -> int:
    statement = (
        select(func.count(func.distinct(col(ChatRound.session_id))))
        .select_from(ChatRound)
        .join(User, _student_join_condition(ChatRound))
        .where(
            col(User.role) == UserRole.STUDENT,
            col(ChatRound.created_at) >= start_at,
            col(ChatRound.created_at) < end_at,
        )
    )
    total = await session.scalar(statement)
    return int(total or 0)


async def count_answers(
    session: AsyncSession,
    *,
    start_at: datetime,
    end_at: datetime,
) -> int:
    statement = (
        select(func.count())
        .select_from(QuestionAttempt)
        .join(User, _student_join_condition(QuestionAttempt))
        .where(
            col(User.role) == UserRole.STUDENT,
            col(QuestionAttempt.created_at) >= start_at,
            col(QuestionAttempt.created_at) < end_at,
        )
    )
    total = await session.scalar(statement)
    return int(total or 0)


async def token_totals(
    session: AsyncSession,
    *,
    start_at: datetime,
    end_at: datetime,
) -> tuple[int, int, int, int]:
    statement = (
        select(
            func.coalesce(func.sum(ReplyUsage.input_tokens), 0),
            func.coalesce(func.sum(ReplyUsage.output_tokens), 0),
            func.coalesce(func.sum(ReplyUsage.cache_input_tokens), 0),
            func.coalesce(
                func.sum(ReplyUsage.input_tokens + ReplyUsage.output_tokens),
                0,
            ),
        )
        .select_from(ReplyUsage)
        .join(User, _student_join_condition(ReplyUsage))
        .where(
            col(User.role) == UserRole.STUDENT,
            col(ReplyUsage.started_at) >= start_at,
            col(ReplyUsage.started_at) < end_at,
        )
    )
    row = (await session.execute(statement)).one()
    return int(row[0]), int(row[1]), int(row[2]), int(row[3])


async def daily_tokens(
    session: AsyncSession,
    *,
    start_at: datetime,
    end_at: datetime,
) -> dict[date, tuple[int, int, int]]:
    day = _day_column(ReplyUsage.started_at).label("day")
    statement = (
        select(
            day,
            func.coalesce(func.sum(ReplyUsage.input_tokens), 0).label("input_tokens"),
            func.coalesce(func.sum(ReplyUsage.output_tokens), 0).label("output_tokens"),
            func.coalesce(func.sum(ReplyUsage.cache_input_tokens), 0).label(
                "cache_input_tokens"
            ),
        )
        .select_from(ReplyUsage)
        .join(User, _student_join_condition(ReplyUsage))
        .where(
            col(User.role) == UserRole.STUDENT,
            col(ReplyUsage.started_at) >= start_at,
            col(ReplyUsage.started_at) < end_at,
        )
        .group_by(day)
    )
    rows = (await session.execute(statement)).all()
    return {
        row.day: (int(row.input_tokens), int(row.output_tokens), int(row.cache_input_tokens))
        for row in rows
    }


async def daily_rounds(
    session: AsyncSession,
    *,
    start_at: datetime,
    end_at: datetime,
) -> dict[date, tuple[int, int]]:
    day = _day_column(ChatRound.created_at).label("day")
    statement = (
        select(
            day,
            func.count().label("rounds"),
            func.count(func.distinct(col(ChatRound.user_id))).label("active_students"),
        )
        .select_from(ChatRound)
        .join(User, _student_join_condition(ChatRound))
        .where(
            col(User.role) == UserRole.STUDENT,
            col(ChatRound.created_at) >= start_at,
            col(ChatRound.created_at) < end_at,
        )
        .group_by(day)
    )
    rows = (await session.execute(statement)).all()
    return {row.day: (int(row.rounds), int(row.active_students)) for row in rows}


async def daily_answers(
    session: AsyncSession,
    *,
    start_at: datetime,
    end_at: datetime,
) -> dict[date, int]:
    day = _day_column(QuestionAttempt.created_at).label("day")
    statement = (
        select(day, func.count().label("answers"))
        .select_from(QuestionAttempt)
        .join(User, _student_join_condition(QuestionAttempt))
        .where(
            col(User.role) == UserRole.STUDENT,
            col(QuestionAttempt.created_at) >= start_at,
            col(QuestionAttempt.created_at) < end_at,
        )
        .group_by(day)
    )
    rows = (await session.execute(statement)).all()
    return {row.day: int(row.answers) for row in rows}


async def daily_new_students(
    session: AsyncSession,
    *,
    start_at: datetime,
    end_at: datetime,
) -> dict[date, int]:
    day = _day_column(User.created_at).label("day")
    statement = (
        select(day, func.count().label("new_students"))
        .where(
            col(User.role) == UserRole.STUDENT,
            col(User.created_at) >= start_at,
            col(User.created_at) < end_at,
        )
        .group_by(day)
    )
    rows = (await session.execute(statement)).all()
    return {row.day: int(row.new_students) for row in rows}


async def ranking(
    session: AsyncSession,
    *,
    start_at: datetime,
    end_at: datetime,
    sort: AdminRankingSort,
    limit: int,
) -> list[RankingRow]:
    tokens_sq = (
        select(
            col(ReplyUsage.user_id).label("user_id"),
            func.coalesce(
                func.sum(ReplyUsage.input_tokens + ReplyUsage.output_tokens),
                0,
            ).label("tokens"),
        )
        .where(
            col(ReplyUsage.started_at) >= start_at,
            col(ReplyUsage.started_at) < end_at,
        )
        .group_by(col(ReplyUsage.user_id))
        .subquery()
    )
    rounds_sq = (
        select(
            col(ChatRound.user_id).label("user_id"),
            func.count().label("rounds"),
            func.count(func.distinct(col(ChatRound.session_id))).label("sessions"),
            func.max(col(ChatRound.created_at)).label("last_active_at"),
        )
        .where(
            col(ChatRound.created_at) >= start_at,
            col(ChatRound.created_at) < end_at,
        )
        .group_by(col(ChatRound.user_id))
        .subquery()
    )
    answers_sq = (
        select(
            col(QuestionAttempt.user_id).label("user_id"),
            func.count().label("answers"),
        )
        .where(
            col(QuestionAttempt.created_at) >= start_at,
            col(QuestionAttempt.created_at) < end_at,
        )
        .group_by(col(QuestionAttempt.user_id))
        .subquery()
    )

    tokens = func.coalesce(tokens_sq.c.tokens, 0)
    rounds = func.coalesce(rounds_sq.c.rounds, 0)
    answers = func.coalesce(answers_sq.c.answers, 0)
    sessions = func.coalesce(rounds_sq.c.sessions, 0)
    last_active_at = rounds_sq.c.last_active_at

    order_column = {
        AdminRankingSort.TOKENS: tokens,
        AdminRankingSort.ROUNDS: rounds,
        AdminRankingSort.ANSWERS: answers,
        AdminRankingSort.SESSIONS: sessions,
    }[sort]

    statement = (
        select(
            col(User.id),
            col(User.username),
            tokens.label("tokens"),
            rounds.label("rounds"),
            answers.label("answers"),
            sessions.label("sessions"),
            last_active_at.label("last_active_at"),
        )
        .outerjoin(tokens_sq, tokens_sq.c.user_id == col(User.id))
        .outerjoin(rounds_sq, rounds_sq.c.user_id == col(User.id))
        .outerjoin(answers_sq, answers_sq.c.user_id == col(User.id))
        .where(
            col(User.role) == UserRole.STUDENT,
            or_(tokens > 0, rounds > 0, answers > 0),
        )
        .order_by(order_column.desc(), col(User.username).asc(), col(User.id))
        .limit(limit)
    )
    rows = (await session.execute(statement)).all()
    return [
        RankingRow(
            user_id=row[0],
            username=row[1],
            tokens=int(row[2]),
            rounds=int(row[3]),
            answers=int(row[4]),
            sessions=int(row[5]),
            last_active_at=row[6],
        )
        for row in rows
    ]
