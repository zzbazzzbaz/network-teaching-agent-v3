from datetime import UTC, datetime

from fastapi import APIRouter

from app.api.dependencies import InternalUser, SessionDep
from app.api.repositories import usage_repositories
from app.api.repositories.models import ChatSession
from app.shared.dto.internal_usage import ReplyUsageReport
from app.shared.errors import not_found

router = APIRouter(
    prefix="/internal/usage",
    tags=["内部接口"],
    include_in_schema=False,
)


@router.post("/replies", response_model=bool, summary="回写回复 token 用量")
async def write_reply_usage(
    body: ReplyUsageReport,
    user: InternalUser,
    session: SessionDep,
) -> bool:
    chat = await session.get(ChatSession, body.session_id)
    if chat is None or chat.user_id != user.id:
        raise not_found()
    now = datetime.now(UTC)
    started_at = body.started_at or now
    if started_at > now:
        started_at = now
    await usage_repositories.upsert_reply_usage(
        session,
        reply_id=body.reply_id,
        user_id=user.id,
        session_id=body.session_id,
        input_tokens=body.input_tokens,
        output_tokens=body.output_tokens,
        cache_input_tokens=body.cache_input_tokens,
        cache_creation_input_tokens=body.cache_creation_input_tokens,
        started_at=started_at,
        reported_at=now,
    )
    return True
