import logging

from fastapi import APIRouter

from app.api.dependencies import CurrentUser, SessionDep
from app.api.endpoints.schemas.auth import (
    AuthResponse,
    LoginRequest,
    RefreshRequest,
    UserResponse,
)
from app.api.errors import forbidden, unauthorized
from app.services import user_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["认证"])


@router.post("/login", response_model=AuthResponse, summary="账号密码登录")
async def login(payload: LoginRequest, session: SessionDep) -> AuthResponse:
    try:
        tokens = await user_service.login(session, payload.username, payload.password)
    except user_service.InvalidCredentialsError as exc:
        logger.warning("login failed: username=%s", payload.username)
        raise unauthorized() from exc
    except user_service.InactiveUserError as exc:
        logger.warning("login rejected, inactive: username=%s", payload.username)
        raise unauthorized() from exc
    return AuthResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        expires_in=tokens.expires_in,
    )


@router.post("/refresh", response_model=AuthResponse, summary="刷新令牌")
async def refresh(payload: RefreshRequest, session: SessionDep) -> AuthResponse:
    try:
        tokens = await user_service.refresh(session, payload.refresh_token)
    except user_service.InvalidCredentialsError as exc:
        logger.warning("refresh token rejected")
        raise unauthorized() from exc
    except user_service.InactiveUserError as exc:
        logger.warning("refresh rejected, inactive user")
        raise forbidden() from exc
    return AuthResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        expires_in=tokens.expires_in,
    )


@router.get("/me", response_model=UserResponse, summary="当前登录用户")
async def me(current_user: CurrentUser) -> UserResponse:
    return UserResponse.model_validate(current_user)
