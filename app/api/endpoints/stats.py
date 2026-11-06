from typing import Annotated

from fastapi import APIRouter, Query

from app.api.dependencies import CurrentUser, SessionDep
from app.services import stats_service
from app.shared.dto.stats import DailyStatsItem, MyStatsResponse, StatsTotals

router = APIRouter(prefix="/stats", tags=["统计"])


@router.get("/me", response_model=MyStatsResponse, summary="我的用量统计")
async def get_my_stats(
    session: SessionDep,
    current_user: CurrentUser,
    days: Annotated[int, Query(ge=1, le=365)] = 30,
) -> MyStatsResponse:
    snapshot = await stats_service.get_stats(session, user_id=current_user.id, days=days)
    return MyStatsResponse(
        totals=StatsTotals(
            tokens=snapshot.total_tokens,
            sessions=snapshot.total_sessions,
            rounds=snapshot.total_rounds,
            answers=snapshot.total_answers,
        ),
        daily=[
            DailyStatsItem(
                date=item.date,
                tokens=item.tokens,
                cache_hit_rate=item.cache_hit_rate,
                rounds=item.rounds,
                input_tokens=item.input_tokens,
                output_tokens=item.output_tokens,
                cache_input_tokens=item.cache_input_tokens,
            )
            for item in snapshot.daily
        ],
    )
