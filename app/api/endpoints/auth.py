import logging

from fastapi import APIRouter

from app.api.dependencies import CurrentUser, SessionDep
from app.api.services import user_service
from app.shared.dto.auth import (
    AuthResponse,
    ChangePasswordRequest,
    LoginRequest,
    RefreshRequest,
    UserResponse,
)
from app.shared.errors import account_unavailable, bad_request_detail, unauthorized

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
        raise account_unavailable() from exc
    return AuthResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        expires_in=tokens.expires_in,
    )


@router.get("/me", response_model=UserResponse, summary="当前登录用户")
async def me(current_user: CurrentUser) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.post("/change-password", response_model=UserResponse, summary="修改自己的密码")
async def change_password(
    payload: ChangePasswordRequest,
    session: SessionDep,
    current_user: CurrentUser,
) -> UserResponse:
    try:
        user = await user_service.change_password(
            session,
            user=current_user,
            old_password=payload.old_password,
            new_password=payload.new_password,
        )
    except user_service.InvalidPasswordError as exc:
        raise bad_request_detail("当前密码不正确") from exc
    except user_service.SamePasswordError as exc:
        raise bad_request_detail("新密码不能与当前密码相同") from exc
    except user_service.DefaultPasswordError as exc:
        raise bad_request_detail("新密码不能使用初始密码") from exc
    await session.commit()
    return UserResponse.model_validate(user)
