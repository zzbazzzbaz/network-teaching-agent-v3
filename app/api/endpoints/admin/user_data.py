import logging
import uuid
from datetime import date as Date
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi import Path as PathParam

from app.api.dependencies import AdminUser, SessionDep
from app.api.repositories.models import ChatSession
from app.api.services import (
    admin_user_service,
    memory_service,
    session_service,
    stats_service,
)
from app.shared.constants import SESSION_PLACEHOLDER_TITLE
from app.shared.dto.memory import MemoryEntryDetailDTO, MemoryEntryListDTO
from app.shared.dto.session import (
    MessageListResponse,
    SessionItem,
    SessionListResponse,
)
from app.shared.dto.stats import DailyStatsItem, MyStatsResponse, StatsTotals
from app.shared.errors import (
    RemoteServiceError,
    bad_request,
    memory_unavailable,
    not_found,
    service_unavailable,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["管理-学生数据"])


def _to_item(chat: ChatSession) -> SessionItem:
    return SessionItem(
        id=chat.id,
        agent_kind=chat.agent_kind,
        title=chat.title or SESSION_PLACEHOLDER_TITLE,
        last_message_at=chat.last_message_at,
        created_at=chat.created_at,
    )


def _agent_failure(exc: RemoteServiceError) -> HTTPException:
    if exc.status_code == 404:
        return not_found()
    return service_unavailable()


def _memory_failure(exc: RemoteServiceError) -> HTTPException:
    if exc.status_code == 404:
        return not_found()
    if exc.status_code in (400, 422):
        return bad_request()
    return memory_unavailable()


async def _target(session: SessionDep, user_id: uuid.UUID):
    try:
        return await admin_user_service.get_user(session, user_id)
    except admin_user_service.AdminUserNotFoundError as exc:
        raise not_found() from exc


@router.get("/{user_id}/stats", response_model=MyStatsResponse, summary="学生统计")
async def get_user_stats(
    user_id: uuid.UUID,
    session: SessionDep,
    _admin: AdminUser,
    days: Annotated[int, Query(ge=1, le=365)] = 30,
) -> MyStatsResponse:
    await _target(session, user_id)
    snapshot = await stats_service.get_stats(session, user_id=user_id, days=days)
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


@router.get(
    "/{user_id}/sessions",
    response_model=SessionListResponse,
    summary="学生会话列表",
)
async def list_user_sessions(
    user_id: uuid.UUID,
    session: SessionDep,
    _admin: AdminUser,
    q: Annotated[str | None, Query(max_length=200)] = None,
    include_empty: bool = False,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> SessionListResponse:
    await _target(session, user_id)
    chats, total = await session_service.list_sessions(
        session,
        user_id=user_id,
        limit=limit,
        offset=offset,
        include_empty=include_empty,
        query=q,
    )
    return SessionListResponse(items=[_to_item(chat) for chat in chats], total=total)


@router.get(
    "/{user_id}/sessions/{session_id}",
    response_model=SessionItem,
    summary="学生会话详情",
)
async def get_user_session(
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    session: SessionDep,
    _admin: AdminUser,
) -> SessionItem:
    await _target(session, user_id)
    try:
        chat = await session_service.get_session(
            session,
            user_id=user_id,
            session_id=session_id,
        )
    except session_service.SessionNotFoundError as exc:
        raise not_found() from exc
    return _to_item(chat)


@router.get(
    "/{user_id}/sessions/{session_id}/messages",
    response_model=MessageListResponse,
    summary="学生会话消息",
)
async def list_user_messages(
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    session: SessionDep,
    _admin: AdminUser,
    before: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> MessageListResponse:
    await _target(session, user_id)
    try:
        chat = await session_service.get_session(
            session,
            user_id=user_id,
            session_id=session_id,
        )
        payload = await session_service.list_messages(
            user_id=user_id,
            chat=chat,
            before=before.strip() if before else None,
            limit=limit,
        )
    except session_service.SessionNotFoundError as exc:
        raise not_found() from exc
    except RemoteServiceError as exc:
        logger.warning(
            "admin agent list messages failed: session_id=%s status=%s detail=%s",
            session_id,
            exc.status_code,
            exc.detail,
        )
        raise _agent_failure(exc) from exc
    return MessageListResponse.model_validate(payload)


@router.get(
    "/{user_id}/memory/entries",
    response_model=MemoryEntryListDTO,
    summary="学生记忆列表",
)
async def list_user_memory_entries(
    user_id: uuid.UUID,
    session: SessionDep,
    _admin: AdminUser,
    kind: Annotated[Literal["daily", "digest"], Query()] = "daily",
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    date: Annotated[str | None, Query(pattern=r"^\d{4}-\d{2}-\d{2}$")] = None,
    session_id: uuid.UUID | None = None,
) -> MemoryEntryListDTO:
    await _target(session, user_id)
    if date is not None:
        try:
            Date.fromisoformat(date)
        except ValueError as exc:
            raise bad_request() from exc

    try:
        return await memory_service.list_entries(
            session,
            user_id=user_id,
            kind=kind,
            limit=limit,
            offset=offset,
            date=date,
            session_id=session_id,
        )
    except memory_service.InvalidMemoryResponseError as exc:
        raise memory_unavailable() from exc
    except RemoteServiceError as exc:
        logger.warning(
            "admin agent memory list failed: user_id=%s status=%s detail=%s",
            user_id,
            exc.status_code,
            exc.detail,
        )
        raise _memory_failure(exc) from exc


@router.get(
    "/{user_id}/memory/entries/{entry_id}",
    response_model=MemoryEntryDetailDTO,
    summary="学生记忆详情",
)
async def get_user_memory_entry(
    user_id: uuid.UUID,
    entry_id: Annotated[str, PathParam(max_length=512)],
    session: SessionDep,
    _admin: AdminUser,
) -> MemoryEntryDetailDTO:
    await _target(session, user_id)
    try:
        return await memory_service.get_entry(
            session,
            user_id=user_id,
            entry_id=entry_id,
        )
    except memory_service.InvalidMemoryResponseError as exc:
        raise memory_unavailable() from exc
    except RemoteServiceError as exc:
        logger.warning(
            "admin agent memory detail failed: user_id=%s status=%s detail=%s",
            user_id,
            exc.status_code,
            exc.detail,
        )
        raise _memory_failure(exc) from exc
