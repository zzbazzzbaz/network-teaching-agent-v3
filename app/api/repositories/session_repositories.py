import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.repositories.models import ChatSession


async def create(session: AsyncSession, chat: ChatSession) -> ChatSession:
    session.add(chat)
    await session.flush()
    return chat


async def get_owned(
    session: AsyncSession,
    *,
    session_id: uuid.UUID,
    user_id: uuid.UUID,
) -> ChatSession | None:
    statement = select(ChatSession).where(
        ChatSession.id == session_id,
        ChatSession.user_id == user_id,
        ChatSession.deleted_at.is_(None),
    )
    return await session.scalar(statement)


async def list_owned(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    limit: int,
    offset: int,
    include_empty: bool,
) -> tuple[list[ChatSession], int]:
    filters = [
        ChatSession.user_id == user_id,
        ChatSession.deleted_at.is_(None),
    ]
    if not include_empty:
        filters.append(ChatSession.last_message_at.is_not(None))

    total = await session.scalar(select(func.count()).select_from(ChatSession).where(*filters))
    statement = (
        select(ChatSession)
        .where(*filters)
        .order_by(
            ChatSession.last_message_at.desc().nullslast(),
            ChatSession.id,
        )
        .limit(limit)
        .offset(offset)
    )
    items = (await session.execute(statement)).scalars().all()
    return list(items), total or 0


async def count_started(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    include_deleted: bool,
) -> int:
    filters = [
        ChatSession.user_id == user_id,
        ChatSession.last_message_at.is_not(None),
    ]
    if not include_deleted:
        filters.append(ChatSession.deleted_at.is_(None))
    total = await session.scalar(select(func.count()).select_from(ChatSession).where(*filters))
    return int(total or 0)


async def touch(session: AsyncSession, chat: ChatSession, at: datetime) -> None:
    chat.last_message_at = at
    session.add(chat)
    await session.flush()


async def rename(session: AsyncSession, chat: ChatSession, title: str) -> None:
    chat.title = title
    session.add(chat)
    await session.flush()


async def soft_delete(session: AsyncSession, chat: ChatSession, at: datetime) -> None:
    chat.deleted_at = at
    session.add(chat)
    await session.flush()


async def get_titles(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    session_ids: set[uuid.UUID],
) -> dict[uuid.UUID, str | None]:
    if not session_ids:
        return {}

    statement = select(ChatSession.id, ChatSession.title).where(
        ChatSession.id.in_(session_ids),
        ChatSession.user_id == user_id,
        ChatSession.deleted_at.is_(None),
    )
    rows = (await session.execute(statement)).all()
    return {row[0]: row[1] for row in rows}
