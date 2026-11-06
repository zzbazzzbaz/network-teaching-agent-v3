import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.repositories import question_repositories, session_repositories, usage_repositories
from app.shared.time import APP_TZ, local_day_end, local_day_start


@dataclass(frozen=True)
class DailyStats:
    date: date
    tokens: int
    cache_hit_rate: float | None
    rounds: int
    input_tokens: int
    output_tokens: int
    cache_input_tokens: int


@dataclass(frozen=True)
class StatsSnapshot:
    total_tokens: int
    total_sessions: int
    total_rounds: int
    total_answers: int
    daily: list[DailyStats]


async def get_stats(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    days: int,
) -> StatsSnapshot:
    today = datetime.now(APP_TZ).date()
    start_day = today - timedelta(days=days - 1)
    start_at = local_day_start(start_day)
    end_at = local_day_end(today)

    total_tokens = await usage_repositories.total_tokens(session, user_id=user_id)
    total_sessions = await session_repositories.count_started(
        session,
        user_id=user_id,
        include_deleted=True,
    )
    total_rounds = await usage_repositories.count_rounds(session, user_id=user_id)
    total_answers = await question_repositories.count_attempts(session, user_id=user_id)

    token_rows = await usage_repositories.daily_tokens(
        session,
        user_id=user_id,
        start_at=start_at,
        end_at=end_at,
    )
    round_rows = await usage_repositories.daily_rounds(
        session,
        user_id=user_id,
        start_at=start_at,
        end_at=end_at,
    )

    tokens_by_day = {row.day: row for row in token_rows}
    rounds_by_day = {row.day: row.rounds for row in round_rows}

    daily: list[DailyStats] = []
    for offset in range(days):
        day = start_day + timedelta(days=offset)
        tokens = tokens_by_day.get(day)
        input_tokens = tokens.input_tokens if tokens else 0
        output_tokens = tokens.output_tokens if tokens else 0
        cache_input_tokens = tokens.cache_input_tokens if tokens else 0
        cache_hit_rate = round(cache_input_tokens / input_tokens, 4) if input_tokens > 0 else None
        daily.append(
            DailyStats(
                date=day,
                tokens=input_tokens + output_tokens,
                cache_hit_rate=cache_hit_rate,
                rounds=rounds_by_day.get(day, 0),
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cache_input_tokens=cache_input_tokens,
            )
        )

    return StatsSnapshot(
        total_tokens=total_tokens,
        total_sessions=total_sessions,
        total_rounds=total_rounds,
        total_answers=total_answers,
        daily=daily,
    )
