import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.repositories.models import User, UserStatus


async def get_by_username(session: AsyncSession, username: str) -> User | None:
    result = await session.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def get_by_id(session: AsyncSession, user_id: uuid.UUID) -> User | None:
    return await session.get(User, user_id)


async def create(
    session: AsyncSession,
    *,
    username: str,
    password_hash: str,
    status: UserStatus = UserStatus.ACTIVE,
) -> User:
    user = User(username=username, password_hash=password_hash, status=status)
    session.add(user)
    await session.flush()
    return user
