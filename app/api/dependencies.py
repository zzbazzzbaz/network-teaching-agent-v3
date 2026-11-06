import logging
import uuid
from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import USER_ID_HEADER
from app.core.database import session_scope
from app.core.security import TokenError, TokenType, decode_token
from app.repositories.models import User, UserStatus
from app.services import user_service
from app.shared.errors import forbidden, unauthorized

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)


async def get_session() -> AsyncGenerator[AsyncSession]:
    async with session_scope() as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]


async def get_current_user(
    session: SessionDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    if credentials is None:
        raise unauthorized()
    try:
        user_id = decode_token(credentials.credentials, TokenType.ACCESS)
    except TokenError as exc:
        logger.warning("access token rejected: %r", exc.__cause__)
        raise unauthorized() from exc
    try:
        user = await user_service.get_user(session, user_id)
    except user_service.UserNotFoundError as exc:
        logger.warning("token subject not found: user_id=%s", user_id)
        raise unauthorized() from exc
    if user.status is not UserStatus.ACTIVE:
        logger.warning("inactive user rejected: user_id=%s", user.id)
        raise forbidden()
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_access_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> uuid.UUID:
    if credentials is None:
        raise unauthorized()
    try:
        return decode_token(credentials.credentials, TokenType.ACCESS)
    except TokenError as exc:
        logger.warning("stream access token rejected: %r", exc.__cause__)
        raise unauthorized() from exc


StreamUserID = Annotated[uuid.UUID, Depends(get_access_user_id)]


async def get_internal_user(
    session: SessionDep,
    x_user_id: Annotated[str | None, Header(alias=USER_ID_HEADER)] = None,
) -> User:
    if not x_user_id:
        raise unauthorized()
    try:
        user_id = uuid.UUID(x_user_id)
    except ValueError as exc:
        logger.warning("internal call with invalid user id: %r", x_user_id)
        raise unauthorized() from exc
    try:
        return await user_service.get_user(session, user_id)
    except user_service.UserNotFoundError as exc:
        logger.warning("internal call with unknown user: user_id=%s", user_id)
        raise unauthorized() from exc


InternalUser = Annotated[User, Depends(get_internal_user)]
