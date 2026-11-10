import uuid
from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import col, select

from app.api.repositories.models import ChatSession, File


async def create(session: AsyncSession, file: File) -> File:
    session.add(file)
    await session.flush()
    return file


async def get_by_id(session: AsyncSession, file_id: uuid.UUID) -> File | None:
    return await session.get(File, file_id)


async def get_by_ids(
    session: AsyncSession,
    file_ids: Sequence[uuid.UUID],
) -> list[File]:
    if not file_ids:
        return []
    statement = select(File).where(col(File.id).in_(list(file_ids)))
    return list((await session.execute(statement)).scalars().all())


async def session_owned_by(
    session: AsyncSession,
    *,
    session_id: uuid.UUID,
    user_id: uuid.UUID,
) -> bool:
    statement = select(ChatSession.id).where(
        col(ChatSession.id) == session_id,
        col(ChatSession.user_id) == user_id,
        col(ChatSession.deleted_at).is_(None),
    )
    return await session.scalar(statement) is not None
