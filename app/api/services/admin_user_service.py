import uuid
from datetime import datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.core.security import hash_password
from app.api.repositories import user_repositories
from app.api.repositories.models import User, UserRole, UserStatus
from app.api.repositories.user_repositories import AdminUserRow, AdminUserSort


class AdminUserError(Exception):
    pass


class AdminUserNotFoundError(AdminUserError):
    pass


class UsernameExistsError(AdminUserError):
    pass


class SelfAdminChangeError(AdminUserError):
    pass


class LastAdminError(AdminUserError):
    pass


async def list_users(
    session: AsyncSession,
    *,
    query: str | None,
    role: UserRole | None,
    status: UserStatus | None,
    sort: AdminUserSort,
    limit: int,
    offset: int,
) -> tuple[list[AdminUserRow], int]:
    return await user_repositories.list_admin_users(
        session,
        query=query.strip() if query else None,
        role=role,
        status=status,
        sort=sort,
        limit=limit,
        offset=offset,
    )


async def get_user(session: AsyncSession, user_id: uuid.UUID) -> User:
    user = await user_repositories.get_by_id(session, user_id)
    if user is None:
        raise AdminUserNotFoundError
    return user


async def get_detail(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> tuple[User, datetime | None]:
    user = await get_user(session, user_id)
    last_active = await user_repositories.last_active_at(session, user_id=user_id)
    return user, last_active


async def last_active_at(session: AsyncSession, user_id: uuid.UUID) -> datetime | None:
    return await user_repositories.last_active_at(session, user_id=user_id)


async def create_user(
    session: AsyncSession,
    *,
    username: str,
    password: str,
    role: UserRole,
    status: UserStatus,
) -> User:
    normalized = username.strip()
    if await user_repositories.get_by_username(session, normalized) is not None:
        raise UsernameExistsError
    try:
        return await user_repositories.create(
            session,
            username=normalized,
            password_hash=hash_password(password),
            role=role,
            status=status,
        )
    except IntegrityError as exc:
        await session.rollback()
        raise UsernameExistsError from exc


async def update_status(
    session: AsyncSession,
    *,
    operator: User,
    user_id: uuid.UUID,
    status: UserStatus,
) -> User:
    user = await get_user(session, user_id)

    if user.id == operator.id and status is not UserStatus.ACTIVE:
        raise SelfAdminChangeError

    was_active_admin = user.role is UserRole.ADMIN and user.status is UserStatus.ACTIVE
    if was_active_admin and status is not UserStatus.ACTIVE:
        remaining = await user_repositories.count_active_admins(
            session,
            exclude_user_id=user.id,
        )
        if remaining == 0:
            raise LastAdminError

    return await user_repositories.update_user(session, user, status=status)


async def reset_password(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    new_password: str,
) -> None:
    user = await get_user(session, user_id)
    await user_repositories.set_password(session, user, hash_password(new_password))
