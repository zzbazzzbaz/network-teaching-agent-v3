import logging
import re
import uuid
from collections.abc import AsyncIterator
from typing import Annotated, Any

import httpx
from fastapi import APIRouter, Body, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.api.dependencies import CurrentUser, SessionDep, StreamUserID
from app.core.database import session_scope
from app.infra.agent_client import get_agent_client
from app.repositories.models import ChatSession, UserStatus
from app.services import session_service, user_service
from app.shared.constants import SESSION_PLACEHOLDER_TITLE
from app.shared.dto.session import (
    InterruptResponse,
    MessageListResponse,
    RenameSessionRequest,
    SendMessageRequest,
    SendMessageResponse,
    SessionItem,
    SessionListResponse,
    SessionStatusResponse,
)
from app.shared.errors import (
    RemoteServiceError,
    conflict,
    forbidden,
    not_found,
    service_unavailable,
    unauthorized,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sessions", tags=["对话"])

_ALLOWED_EVENT_TYPES = {"EXTERNAL_EXECUTION_RESULT", "USER_CONFIRM_RESULT"}
_EVENT_CURSOR_PATTERN = re.compile(r"^\d+-\d+$")


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
    if exc.status_code == 409:
        return conflict()
    return service_unavailable()


def _non_empty_list(value: Any) -> bool:
    return isinstance(value, list) and bool(value)


def _normalize_event_cursor(value: str | None) -> str | None:
    if not value:
        return None
    cursor = value.strip()
    if not cursor:
        return None
    if not _EVENT_CURSOR_PATTERN.fullmatch(cursor):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的事件游标",
        )
    return cursor


@router.post(
    "",
    response_model=SessionItem,
    status_code=status.HTTP_201_CREATED,
    summary="创建会话",
)
async def create_session(session: SessionDep, current_user: CurrentUser) -> SessionItem:
    try:
        chat = await session_service.create_session(session, user_id=current_user.id)
    except session_service.InvalidAgentResponseError as exc:
        raise service_unavailable() from exc
    except RemoteServiceError as exc:
        logger.warning(
            "agent create session failed: user_id=%s status=%s detail=%s",
            current_user.id,
            exc.status_code,
            exc.detail,
        )
        raise service_unavailable() from exc
    logger.info("session created: user_id=%s session_id=%s", current_user.id, chat.id)
    return _to_item(chat)


@router.get("", response_model=SessionListResponse, summary="会话列表")
async def list_sessions(
    session: SessionDep,
    current_user: CurrentUser,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    include_empty: bool = False,
) -> SessionListResponse:
    chats, total = await session_service.list_sessions(
        session,
        user_id=current_user.id,
        limit=limit,
        offset=offset,
        include_empty=include_empty,
    )
    return SessionListResponse(items=[_to_item(chat) for chat in chats], total=total)


@router.get("/{session_id}", response_model=SessionItem, summary="会话详情")
async def get_session(
    session_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> SessionItem:
    try:
        chat = await session_service.get_session(
            session,
            user_id=current_user.id,
            session_id=session_id,
        )
    except session_service.SessionNotFoundError as exc:
        raise not_found() from exc
    return _to_item(chat)


@router.patch("/{session_id}", response_model=SessionItem, summary="重命名会话")
async def rename_session(
    session_id: uuid.UUID,
    payload: RenameSessionRequest,
    session: SessionDep,
    current_user: CurrentUser,
) -> SessionItem:
    title = payload.title.strip()
    if not title:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="标题不能为空",
        )
    try:
        chat = await session_service.rename_session(
            session,
            user_id=current_user.id,
            session_id=session_id,
            title=title,
        )
    except session_service.SessionNotFoundError as exc:
        raise not_found() from exc
    return _to_item(chat)


@router.delete(
    "/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除会话",
)
async def delete_session(
    session_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> None:
    try:
        await session_service.delete_session(
            session,
            user_id=current_user.id,
            session_id=session_id,
        )
    except session_service.SessionNotFoundError as exc:
        raise not_found() from exc


@router.post(
    "/{session_id}/messages",
    response_model=SendMessageResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="发送消息",
)
async def send_message(
    session_id: uuid.UUID,
    payload: SendMessageRequest,
    session: SessionDep,
    current_user: CurrentUser,
) -> SendMessageResponse:
    try:
        chat = await session_service.get_session(
            session,
            user_id=current_user.id,
            session_id=session_id,
        )
        await session_service.send_message(
            session,
            user=current_user,
            chat=chat,
            text=payload.text,
            attachments=payload.attachments,
        )
    except session_service.SessionNotFoundError as exc:
        raise not_found() from exc
    except session_service.InvalidMessageError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except RemoteServiceError as exc:
        logger.warning(
            "agent chat trigger failed: user_id=%s session_id=%s status=%s detail=%s",
            current_user.id,
            session_id,
            exc.status_code,
            exc.detail,
        )
        raise _agent_failure(exc) from exc
    logger.info(
        "message sent: user_id=%s session_id=%s attachments=%s",
        current_user.id,
        session_id,
        len(payload.attachments),
    )
    return SendMessageResponse(status="started", session_id=session_id)


@router.get(
    "/{session_id}/messages",
    response_model=MessageListResponse,
    summary="历史消息",
)
async def list_messages(
    session_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    before: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> MessageListResponse:
    try:
        chat = await session_service.get_session(
            session,
            user_id=current_user.id,
            session_id=session_id,
        )
        payload = await session_service.list_messages(
            user_id=current_user.id,
            chat=chat,
            before=before.strip() if before else None,
            limit=limit,
        )
    except session_service.SessionNotFoundError as exc:
        raise not_found() from exc
    except RemoteServiceError as exc:
        logger.warning(
            "agent list messages failed: session_id=%s status=%s detail=%s",
            session_id,
            exc.status_code,
            exc.detail,
        )
        raise _agent_failure(exc) from exc
    return MessageListResponse.model_validate(payload)


@router.get("/{session_id}/stream", summary="会话事件流")
async def stream_session(
    session_id: uuid.UUID,
    user_id: StreamUserID,
    after: Annotated[str | None, Query()] = None,
) -> StreamingResponse:
    async with session_scope() as session:
        try:
            user = await user_service.get_user(session, user_id)
        except user_service.UserNotFoundError as exc:
            raise unauthorized() from exc
        if user.status is not UserStatus.ACTIVE:
            raise forbidden()
        try:
            chat = await session_service.get_session(
                session,
                user_id=user_id,
                session_id=session_id,
            )
        except session_service.SessionNotFoundError as exc:
            raise not_found() from exc

    stream = get_agent_client().stream_events(
        user_id=str(user_id),
        agent_id=chat.agent_kind.value,
        session_id=session_id.hex,
        after=_normalize_event_cursor(after),
    )
    try:
        upstream = await stream.__aenter__()
    except RemoteServiceError as exc:
        logger.warning(
            "agent stream failed: session_id=%s status=%s detail=%s",
            session_id,
            exc.status_code,
            exc.detail,
        )
        raise _agent_failure(exc) from exc

    async def relay() -> AsyncIterator[bytes]:
        try:
            async for chunk in upstream.aiter_raw():
                yield chunk
        except httpx.HTTPError:
            logger.warning("agent stream interrupted: session_id=%s", session_id)
        finally:
            await stream.__aexit__(None, None, None)

    logger.info("stream opened: user_id=%s session_id=%s", user_id, session_id)
    return StreamingResponse(
        relay(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post(
    "/{session_id}/stop",
    response_model=InterruptResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="终止生成",
)
async def stop_session(
    session_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> InterruptResponse:
    try:
        chat = await session_service.get_session(
            session,
            user_id=current_user.id,
            session_id=session_id,
        )
        await session_service.interrupt(user_id=current_user.id, chat=chat)
    except session_service.SessionNotFoundError as exc:
        raise not_found() from exc
    except RemoteServiceError as exc:
        logger.warning(
            "agent interrupt failed: session_id=%s status=%s detail=%s",
            session_id,
            exc.status_code,
            exc.detail,
        )
        raise _agent_failure(exc) from exc
    return InterruptResponse(session_id=session_id)


@router.post(
    "/{session_id}/events",
    response_model=SendMessageResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="提交 HITL 结果",
)
async def submit_event(
    session_id: uuid.UUID,
    payload: Annotated[dict[str, Any], Body()],
    session: SessionDep,
    current_user: CurrentUser,
) -> SendMessageResponse:
    event_type = payload.get("type")
    if not isinstance(event_type, str) or event_type not in _ALLOWED_EVENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不支持的事件类型",
        )
    reply_id = payload.get("reply_id")
    if not isinstance(reply_id, str) or not reply_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="事件格式不正确",
        )
    if event_type == "EXTERNAL_EXECUTION_RESULT" and not _non_empty_list(
        payload.get("execution_results")
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="事件格式不正确",
        )
    if event_type == "USER_CONFIRM_RESULT" and not _non_empty_list(
        payload.get("confirm_results")
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="事件格式不正确",
        )

    try:
        chat = await session_service.get_session(
            session,
            user_id=current_user.id,
            session_id=session_id,
        )
        await session_service.submit_event(
            user_id=current_user.id,
            chat=chat,
            event=payload,
        )
    except session_service.SessionNotFoundError as exc:
        raise not_found() from exc
    except RemoteServiceError as exc:
        logger.warning(
            "agent event submit failed: session_id=%s status=%s detail=%s",
            session_id,
            exc.status_code,
            exc.detail,
        )
        raise _agent_failure(exc) from exc
    return SendMessageResponse(status="started", session_id=session_id)


@router.get(
    "/{session_id}/status",
    response_model=SessionStatusResponse,
    summary="会话运行状态",
)
async def get_session_status(
    session_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> SessionStatusResponse:
    try:
        chat = await session_service.get_session(
            session,
            user_id=current_user.id,
            session_id=session_id,
        )
        current_status = await session_service.get_status(
            user_id=current_user.id,
            chat=chat,
        )
    except session_service.SessionNotFoundError as exc:
        raise not_found() from exc
    except RemoteServiceError as exc:
        logger.warning(
            "agent status failed: session_id=%s status=%s detail=%s",
            session_id,
            exc.status_code,
            exc.detail,
        )
        raise _agent_failure(exc) from exc
    return SessionStatusResponse(session_id=session_id, status=current_status)
