import uuid

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement
from sqlmodel import col, select

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
        col(ChatSession.id) == session_id,
        col(ChatSession.user_id) == user_id,
        col(ChatSession.deleted_at).is_(None),
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
    filters: list[ColumnElement[bool]] = [
        col(File.session_id) == session_id,
        col(File.user_id) == user_id,
        col(File.status) == FileStatus.READY,
        col(File.deleted_at).is_(None),
    ]
    total = await session.scalar(select(func.count()).select_from(File).where(*filters))
    statement = (
        select(File)
        .where(*filters)
        .order_by(col(File.created_at).desc(), col(File.id))
        .limit(limit)
        .offset(offset)
    )
    items = (await session.execute(statement)).scalars().all()
    return list(items), total or 0
