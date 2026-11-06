import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.repositories.models import ChatSession, File, FileStatus


async def create(session: AsyncSession, file: File) -> File:
    session.add(file)
    await session.flush()
    return file


async def get_by_id(session: AsyncSession, file_id: uuid.UUID) -> File | None:
    return await session.get(File, file_id)


async def session_owned_by(
    session: AsyncSession,
    *,
    session_id: uuid.UUID,
    user_id: uuid.UUID,
) -> bool:
    statement = select(ChatSession.id).where(
        ChatSession.id == session_id,
        ChatSession.user_id == user_id,
        ChatSession.deleted_at.is_(None),
    )
    return await session.scalar(statement) is not None


async def list_by_session(
    session: AsyncSession,
    *,
    session_id: uuid.UUID,
    user_id: uuid.UUID,
    limit: int,
    offset: int,
) -> tuple[list[File], int]:
    filters = [
        File.session_id == session_id,
        File.user_id == user_id,
        File.status == FileStatus.READY,
        File.deleted_at.is_(None),
    ]
    total = await session.scalar(select(func.count()).select_from(File).where(*filters))
    statement = (
        select(File)
        .where(*filters)
        .order_by(File.created_at.desc(), File.id)
        .limit(limit)
        .offset(offset)
    )
    items = (await session.execute(statement)).scalars().all()
    return list(items), total or 0
