from datetime import date, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.repositories import admin_stats_repositories
from app.api.repositories.admin_stats_repositories import (
    AdminRankingSort,
    DailyOverviewRow,
    OverviewTotals,
    RankingRow,
)
from app.shared.time import APP_TZ, local_day_end, local_day_start


def _range(days: int) -> tuple[date, datetime, datetime]:
    today = datetime.now(APP_TZ).date()
    start_day = today - timedelta(days=days - 1)
    return start_day, local_day_start(start_day), local_day_end(today)


async def get_overview(
    session: AsyncSession,
    *,
    days: int,
) -> tuple[OverviewTotals, list[DailyOverviewRow]]:
    start_day, start_at, end_at = _range(days)

    students_total = await admin_stats_repositories.count_students_total(session)
    students_new = await admin_stats_repositories.count_students_new(
        session,
        start_at=start_at,
        end_at=end_at,
    )
    students_active = await admin_stats_repositories.count_active_students(
        session,
        start_at=start_at,
        end_at=end_at,
    )
    sessions = await admin_stats_repositories.count_sessions(
        session,
        start_at=start_at,
        end_at=end_at,
    )
    rounds = await admin_stats_repositories.count_rounds(
        session,
        start_at=start_at,
        end_at=end_at,
    )
    answers = await admin_stats_repositories.count_answers(
        session,
        start_at=start_at,
        end_at=end_at,
    )
    input_tokens, output_tokens, cache_input_tokens, tokens = (
        await admin_stats_repositories.token_totals(
            session,
            start_at=start_at,
            end_at=end_at,
        )
    )

    token_rows = await admin_stats_repositories.daily_tokens(
        session,
        start_at=start_at,
        end_at=end_at,
    )
    round_rows = await admin_stats_repositories.daily_rounds(
        session,
        start_at=start_at,
        end_at=end_at,
    )
    answer_rows = await admin_stats_repositories.daily_answers(
        session,
        start_at=start_at,
        end_at=end_at,
    )
    new_student_rows = await admin_stats_repositories.daily_new_students(
        session,
        start_at=start_at,
        end_at=end_at,
    )

    daily: list[DailyOverviewRow] = []
    for offset in range(days):
        day = start_day + timedelta(days=offset)
        day_input, day_output, day_cache = token_rows.get(day, (0, 0, 0))
        day_rounds, day_active = round_rows.get(day, (0, 0))
        daily.append(
            DailyOverviewRow(
                date=day,
                tokens=day_input + day_output,
                input_tokens=day_input,
                output_tokens=day_output,
                cache_input_tokens=day_cache,
                rounds=day_rounds,
                answers=answer_rows.get(day, 0),
                active_students=day_active,
                new_students=new_student_rows.get(day, 0),
            )
        )

    totals = OverviewTotals(
        students_total=students_total,
        students_active=students_active,
        students_new=students_new,
        sessions=sessions,
        rounds=rounds,
        answers=answers,
        tokens=tokens,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cache_input_tokens=cache_input_tokens,
    )
    return totals, daily


async def get_ranking(
    session: AsyncSession,
    *,
    days: int,
    sort: AdminRankingSort,
    limit: int,
) -> list[RankingRow]:
    _, start_at, end_at = _range(days)
    return await admin_stats_repositories.ranking(
        session,
        start_at=start_at,
        end_at=end_at,
        sort=sort,
        limit=limit,
    )
