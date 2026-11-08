from typing import Annotated

from fastapi import APIRouter, Query

from app.api.dependencies import AdminUser, SessionDep
from app.api.repositories.admin_stats_repositories import AdminRankingSort
from app.api.services import admin_stats_service
from app.shared.dto.admin import (
    AdminOverviewDailyItem,
    AdminOverviewResponse,
    AdminUserRankingItem,
    AdminUserRankingResponse,
)

router = APIRouter(prefix="/stats", tags=["管理-统计"])


def _cache_hit_rate(cache_input_tokens: int, input_tokens: int) -> float | None:
    if input_tokens <= 0:
        return None
    return round(cache_input_tokens / input_tokens, 4)


@router.get("/overview", response_model=AdminOverviewResponse, summary="总体概览")
async def get_overview(
    session: SessionDep,
    _admin: AdminUser,
    days: Annotated[int, Query(ge=1, le=365)] = 30,
) -> AdminOverviewResponse:
    totals, daily = await admin_stats_service.get_overview(session, days=days)
    return AdminOverviewResponse(
        students_total=totals.students_total,
        students_active=totals.students_active,
        students_new=totals.students_new,
        sessions=totals.sessions,
        rounds=totals.rounds,
        answers=totals.answers,
        tokens=totals.tokens,
        input_tokens=totals.input_tokens,
        output_tokens=totals.output_tokens,
        cache_input_tokens=totals.cache_input_tokens,
        cache_hit_rate=_cache_hit_rate(
            totals.cache_input_tokens,
            totals.input_tokens,
        ),
        daily=[
            AdminOverviewDailyItem(
                date=item.date,
                tokens=item.tokens,
                input_tokens=item.input_tokens,
                output_tokens=item.output_tokens,
                cache_input_tokens=item.cache_input_tokens,
                cache_hit_rate=_cache_hit_rate(
                    item.cache_input_tokens,
                    item.input_tokens,
                ),
                rounds=item.rounds,
                answers=item.answers,
                active_students=item.active_students,
                new_students=item.new_students,
            )
            for item in daily
        ],
    )


@router.get(
    "/users",
    response_model=AdminUserRankingResponse,
    summary="学生排行",
)
async def get_user_ranking(
    session: SessionDep,
    _admin: AdminUser,
    days: Annotated[int, Query(ge=1, le=365)] = 30,
    sort: AdminRankingSort = AdminRankingSort.TOKENS,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> AdminUserRankingResponse:
    rows = await admin_stats_service.get_ranking(
        session,
        days=days,
        sort=sort,
        limit=limit,
    )
    return AdminUserRankingResponse(
        items=[
            AdminUserRankingItem(
                user_id=row.user_id,
                username=row.username,
                tokens=row.tokens,
                rounds=row.rounds,
                answers=row.answers,
                sessions=row.sessions,
                last_active_at=row.last_active_at,
            )
            for row in rows
        ]
    )
