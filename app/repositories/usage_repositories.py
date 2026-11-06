import uuid
from datetime import date, datetime
from typing import NamedTuple

from sqlalchemy import Date, cast, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.models import ChatRound, ReplyUsage
from app.shared.constants import STATS_TIMEZONE


class DailyTokenUsage(NamedTuple):
    day: date
    input_tokens: int
    output_tokens: int
    cache_input_tokens: int


class DailyRoundCount(NamedTuple):
    day: date
    rounds: int


def _day_column(column):
    return cast(func.timezone(STATS_TIMEZONE, column), Date)


async def upsert_reply_usage(
    session: AsyncSession,
    *,
    reply_id: str,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    input_tokens: int,
    output_tokens: int,
    cache_input_tokens: int,
    cache_creation_input_tokens: int,
    started_at: datetime,
    reported_at: datetime,
) -> None:
    statement = pg_insert(ReplyUsage).values(
        reply_id=reply_id,
        user_id=user_id,
        session_id=session_id,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cache_input_tokens=cache_input_tokens,
        cache_creation_input_tokens=cache_creation_input_tokens,
        started_at=started_at,
        updated_at=reported_at,
    )
    statement = statement.on_conflict_do_update(
        index_elements=[ReplyUsage.reply_id],
        set_={
            "input_tokens": func.greatest(
                ReplyUsage.input_tokens,
                statement.excluded.input_tokens,
            ),
            "output_tokens": func.greatest(
                ReplyUsage.output_tokens,
                statement.excluded.output_tokens,
            ),
            "cache_input_tokens": func.greatest(
                ReplyUsage.cache_input_tokens,
                statement.excluded.cache_input_tokens,
            ),
            "cache_creation_input_tokens": func.greatest(
                ReplyUsage.cache_creation_input_tokens,
                statement.excluded.cache_creation_input_tokens,
            ),
            "updated_at": reported_at,
        },
    )
    await session.execute(statement)


async def create_round(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    created_at: datetime,
) -> None:
    session.add(
        ChatRound(
            user_id=user_id,
            session_id=session_id,
            created_at=created_at,
        )
    )
    await session.flush()


async def total_tokens(session: AsyncSession, *, user_id: uuid.UUID) -> int:
    statement = select(
        func.coalesce(
            func.sum(ReplyUsage.input_tokens + ReplyUsage.output_tokens),
            0,
        )
    ).where(ReplyUsage.user_id == user_id)
    total = await session.scalar(statement)
    return int(total or 0)


async def count_rounds(session: AsyncSession, *, user_id: uuid.UUID) -> int:
    statement = select(func.count()).select_from(ChatRound).where(ChatRound.user_id == user_id)
    total = await session.scalar(statement)
    return int(total or 0)


async def daily_tokens(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    start_at: datetime,
    end_at: datetime,
) -> list[DailyTokenUsage]:
    day = _day_column(ReplyUsage.started_at).label("day")
    statement = (
        select(
            day,
            func.coalesce(func.sum(ReplyUsage.input_tokens), 0).label("input_tokens"),
            func.coalesce(func.sum(ReplyUsage.output_tokens), 0).label("output_tokens"),
            func.coalesce(func.sum(ReplyUsage.cache_input_tokens), 0).label("cache_input_tokens"),
        )
        .where(
            ReplyUsage.user_id == user_id,
            ReplyUsage.started_at >= start_at,
            ReplyUsage.started_at < end_at,
        )
        .group_by(day)
        .order_by(day)
    )
    rows = (await session.execute(statement)).all()
    return [
        DailyTokenUsage(
            day=row.day,
            input_tokens=int(row.input_tokens),
            output_tokens=int(row.output_tokens),
            cache_input_tokens=int(row.cache_input_tokens),
        )
        for row in rows
    ]


async def daily_rounds(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    start_at: datetime,
    end_at: datetime,
) -> list[DailyRoundCount]:
    day = _day_column(ChatRound.created_at).label("day")
    statement = (
        select(day, func.count().label("rounds"))
        .where(
            ChatRound.user_id == user_id,
            ChatRound.created_at >= start_at,
            ChatRound.created_at < end_at,
        )
        .group_by(day)
        .order_by(day)
    )
    rows = (await session.execute(statement)).all()
    return [DailyRoundCount(day=row.day, rounds=int(row.rounds)) for row in rows]
