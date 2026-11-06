import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from agentscope.message import DataBlock, Msg, TextBlock, URLSource
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.endpoints.schemas.session import MessageAttachment
from app.core.config import get_settings
from app.core.constants import (
    AGENT_CREDENTIAL_ID,
    SESSION_PLACEHOLDER_TITLE,
    TEACH_AGENT_ID,
)
from app.infra.agent_client import AgentError, get_agent_client
from app.repositories import file_repositories, session_repositories, usage_repositories
from app.repositories.models import AgentKind, ChatSession, FileStatus, User
from app.services import file_service

logger = logging.getLogger(__name__)

_MAX_ATTACHMENTS = 4


class SessionError(Exception):
    pass


class SessionNotFoundError(SessionError):
    pass


class InvalidMessageError(SessionError):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class InvalidAgentResponseError(SessionError):
    pass


async def create_session(session: AsyncSession, *, user_id: uuid.UUID) -> ChatSession:
    settings = get_settings()
    client = get_agent_client()
    agent_session_id = await client.create_session(
        user_id=str(user_id),
        agent_id=TEACH_AGENT_ID,
        name=SESSION_PLACEHOLDER_TITLE,
        chat_model_config={
            "type": "dashscope_credential",
            "credential_id": AGENT_CREDENTIAL_ID,
            "model": settings.llm.chat_model,
            "parameters": {},
        },
    )
    try:
        session_uuid = uuid.UUID(agent_session_id)
    except ValueError as exc:
        logger.error("agent returned invalid session id: %r", agent_session_id)
        raise InvalidAgentResponseError from exc

    chat = ChatSession(
        id=session_uuid,
        user_id=user_id,
        agent_kind=AgentKind.TEACH,
        title=SESSION_PLACEHOLDER_TITLE,
    )
    try:
        await session_repositories.create(session, chat)
        await session.commit()
    except Exception:
        await session.rollback()
        try:
            await client.delete_session(
                user_id=str(user_id),
                agent_id=TEACH_AGENT_ID,
                session_id=agent_session_id,
            )
        except AgentError:
            logger.warning("failed to compensate agent session: session_id=%s", agent_session_id)
        raise
    return chat


async def list_sessions(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    limit: int,
    offset: int,
    include_empty: bool,
) -> tuple[list[ChatSession], int]:
    return await session_repositories.list_owned(
        session,
        user_id=user_id,
        limit=limit,
        offset=offset,
        include_empty=include_empty,
    )


async def get_session(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
) -> ChatSession:
    chat = await session_repositories.get_owned(
        session,
        session_id=session_id,
        user_id=user_id,
    )
    if chat is None:
        raise SessionNotFoundError
    return chat


async def rename_session(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    title: str,
) -> ChatSession:
    chat = await get_session(session, user_id=user_id, session_id=session_id)
    await session_repositories.rename(session, chat, title)
    return chat


async def delete_session(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
) -> None:
    chat = await get_session(session, user_id=user_id, session_id=session_id)
    try:
        await get_agent_client().delete_session(
            user_id=str(user_id),
            agent_id=chat.agent_kind.value,
            session_id=chat.id.hex,
        )
    except AgentError as exc:
        logger.warning(
            "agent session delete failed: session_id=%s status=%s detail=%s",
            chat.id,
            exc.status_code,
            exc.detail,
        )
    await session_repositories.soft_delete(session, chat, datetime.now(UTC))


async def list_messages(
    *,
    user_id: uuid.UUID,
    chat: ChatSession,
    before: str | None,
    limit: int,
) -> dict[str, Any]:
    return await get_agent_client().list_messages(
        user_id=str(user_id),
        agent_id=chat.agent_kind.value,
        session_id=chat.id.hex,
        before=before,
        limit=limit,
    )


async def send_message(
    session: AsyncSession,
    *,
    user: User,
    chat: ChatSession,
    text: str,
    attachments: list[MessageAttachment],
) -> None:
    normalized_text = text.strip()
    if not normalized_text and not attachments:
        raise InvalidMessageError("消息不能为空")
    if len(attachments) > _MAX_ATTACHMENTS:
        raise InvalidMessageError("最多支持 4 张图片")

    content: list[TextBlock | DataBlock] = []
    if normalized_text:
        content.append(TextBlock(text=normalized_text))
    for attachment in attachments:
        block = await _attachment_block(session, user=user, chat=chat, attachment=attachment)
        content.append(block)

    message = Msg(name=user.username, role="user", content=content)
    await get_agent_client().trigger_chat(
        user_id=str(user.id),
        agent_id=chat.agent_kind.value,
        session_id=chat.id.hex,
        payload=message.model_dump(mode="json"),
    )

    try:
        now = datetime.now(UTC)
        await usage_repositories.create_round(
            session,
            user_id=user.id,
            session_id=chat.id,
            created_at=now,
        )
        await session_repositories.touch(session, chat, now)
        await session.commit()
    except Exception:
        await session.rollback()
        logger.exception("failed to record message round: session_id=%s", chat.id)


async def submit_event(
    *,
    user_id: uuid.UUID,
    chat: ChatSession,
    event: dict[str, Any],
) -> None:
    await get_agent_client().trigger_chat(
        user_id=str(user_id),
        agent_id=chat.agent_kind.value,
        session_id=chat.id.hex,
        payload=event,
    )


async def interrupt(*, user_id: uuid.UUID, chat: ChatSession) -> None:
    await get_agent_client().interrupt(
        user_id=str(user_id),
        agent_id=chat.agent_kind.value,
        session_id=chat.id.hex,
    )


async def get_status(*, user_id: uuid.UUID, chat: ChatSession) -> str:
    payload = await get_agent_client().get_status(
        user_id=str(user_id),
        agent_id=chat.agent_kind.value,
        session_id=chat.id.hex,
    )
    return str(payload.get("status", "idle"))


async def _attachment_block(
    session: AsyncSession,
    *,
    user: User,
    chat: ChatSession,
    attachment: MessageAttachment,
) -> DataBlock:
    if attachment.file_id is not None:
        file = await file_repositories.get_by_id(session, attachment.file_id)
        if (
            file is None
            or file.user_id != user.id
            or file.session_id != chat.id
            or file.deleted_at is not None
            or file.status is not FileStatus.READY
        ):
            raise InvalidMessageError("附件不存在")
        if not file.content_type.startswith("image/"):
            raise InvalidMessageError("仅支持图片附件")
        return DataBlock(
            source=URLSource(
                url=file_service.raw_url(file),
                media_type=file.content_type,
            ),
            name=file.original_name,
        )

    if attachment.url is None:
        raise InvalidMessageError("附件不存在")
    media_type = (attachment.media_type or "").strip().lower()
    if not media_type.startswith("image/"):
        raise InvalidMessageError("仅支持图片附件")
    return DataBlock(
        source=URLSource(url=str(attachment.url), media_type=media_type),
        name=attachment.name,
    )
