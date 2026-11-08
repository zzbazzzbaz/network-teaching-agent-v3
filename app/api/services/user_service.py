import uuid
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.core.security import (
    TokenError,
    TokenType,
    create_token,
    decode_token,
    default_password,
    hash_password,
    verify_password,
)
from app.api.repositories import user_repositories
from app.api.repositories.models import User, UserStatus


class UserError(Exception):
    """用户模块的业务异常基类。"""


class InvalidCredentialsError(UserError):
    pass


class InactiveUserError(UserError):
    pass


class UserNotFoundError(UserError):
    pass


class InvalidPasswordError(UserError):
    pass


class SamePasswordError(UserError):
    pass


class DefaultPasswordError(UserError):
    pass


@dataclass(frozen=True, slots=True)
class TokenBundle:
    access_token: str
    refresh_token: str
    expires_in: int


def _issue(user: User) -> TokenBundle:
    access_token, expires_in = create_token(user.id, TokenType.ACCESS)
    refresh_token, _ = create_token(user.id, TokenType.REFRESH)
    return TokenBundle(
        access_token=access_token, refresh_token=refresh_token, expires_in=expires_in
    )


async def authenticate(session: AsyncSession, username: str, password: str) -> User:
    user = await user_repositories.get_by_username(session, username)
    if user is None or not verify_password(password, user.password_hash):
        raise InvalidCredentialsError
    if user.status is not UserStatus.ACTIVE:
        raise InactiveUserError
    return user


async def login(session: AsyncSession, username: str, password: str) -> TokenBundle:
    user = await authenticate(session, username, password)
    return _issue(user)


async def refresh(session: AsyncSession, refresh_token: str) -> TokenBundle:
    try:
        user_id = decode_token(refresh_token, TokenType.REFRESH)
    except TokenError as exc:
        raise InvalidCredentialsError from exc
    user = await get_user(session, user_id)
    if user.status is not UserStatus.ACTIVE:
        raise InactiveUserError
    return _issue(user)


async def get_user(session: AsyncSession, user_id: uuid.UUID) -> User:
    user = await user_repositories.get_by_id(session, user_id)
    if user is None:
        raise UserNotFoundError
    return user


async def change_password(
    session: AsyncSession,
    *,
    user: User,
    old_password: str,
    new_password: str,
) -> User:
    if not verify_password(old_password, user.password_hash):
        raise InvalidPasswordError
    if new_password == old_password:
        raise SamePasswordError
    if new_password == default_password(user.username):
        raise DefaultPasswordError
    await user_repositories.set_password(session, user, hash_password(new_password))
    return user
