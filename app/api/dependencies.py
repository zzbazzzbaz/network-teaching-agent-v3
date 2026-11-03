import logging
from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import forbidden, unauthorized
from app.core.database import session_scope
from app.core.security import TokenError, TokenType, decode_token
from app.repositories.models import User, UserStatus
from app.services import user_service

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
