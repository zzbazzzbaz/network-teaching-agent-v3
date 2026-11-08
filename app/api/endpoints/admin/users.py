import uuid
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query

from app.api.dependencies import AdminUser, SessionDep
from app.api.repositories.models import User
from app.api.repositories.user_repositories import AdminUserRow, AdminUserSort
from app.api.services import admin_user_service
from app.shared.dto.admin import (
    AdminPasswordResetRequest,
    AdminUserCreateRequest,
    AdminUserDetail,
    AdminUserItem,
    AdminUserListResponse,
    AdminUserStatusRequest,
)
from app.shared.enums import UserRole, UserStatus
from app.shared.errors import not_found

router = APIRouter(prefix="/users", tags=["管理-用户"])


def _username_exists() -> HTTPException:
    return HTTPException(status_code=409, detail="用户名已存在")


def _to_item(row: AdminUserRow) -> AdminUserItem:
    user = row.user
    return AdminUserItem(
        id=user.id,
        username=user.username,
        role=user.role,
        status=user.status,
        created_at=user.created_at,
        last_active_at=row.last_active_at,
        sessions=row.sessions,
        rounds=row.rounds,
        tokens=row.tokens,
        answers=row.answers,
    )


@router.get("", response_model=AdminUserListResponse, summary="用户列表")
async def list_users(
    session: SessionDep,
    _admin: AdminUser,
    q: Annotated[str | None, Query(max_length=64)] = None,
    role: Annotated[Literal["student", "admin", "all"], Query()] = "student",
    status: UserStatus | None = None,
    sort: AdminUserSort = AdminUserSort.CREATED_AT_DESC,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AdminUserListResponse:
    role_filter = None if role == "all" else UserRole(role)
    rows, total = await admin_user_service.list_users(
        session,
        query=q,
        role=role_filter,
        status=status,
        sort=sort,
        limit=limit,
        offset=offset,
    )
    return AdminUserListResponse(items=[_to_item(row) for row in rows], total=total)


@router.post("", response_model=AdminUserDetail, status_code=201, summary="创建用户")
async def create_user(
    payload: AdminUserCreateRequest,
    session: SessionDep,
    _admin: AdminUser,
) -> AdminUserDetail:
    try:
        user = await admin_user_service.create_user(
            session,
            username=payload.username,
            password=payload.password,
            role=payload.role,
            status=payload.status,
        )
    except admin_user_service.UsernameExistsError as exc:
        raise _username_exists() from exc
    await session.commit()
    return _detail(user, None)


@router.get("/{user_id}", response_model=AdminUserDetail, summary="用户详情")
async def get_user(
    user_id: uuid.UUID,
    session: SessionDep,
    _admin: AdminUser,
) -> AdminUserDetail:
    try:
        user, last_active_at = await admin_user_service.get_detail(session, user_id)
    except admin_user_service.AdminUserNotFoundError as exc:
        raise not_found() from exc
    return _detail(user, last_active_at)


@router.patch("/{user_id}/status", response_model=AdminUserDetail, summary="修改用户状态")
async def update_user_status(
    user_id: uuid.UUID,
    payload: AdminUserStatusRequest,
    session: SessionDep,
    admin: AdminUser,
) -> AdminUserDetail:
    try:
        user = await admin_user_service.update_status(
            session,
            operator=admin,
            user_id=user_id,
            status=payload.status,
        )
    except admin_user_service.AdminUserNotFoundError as exc:
        raise not_found() from exc
    except admin_user_service.SelfAdminChangeError as exc:
        raise HTTPException(status_code=409, detail="不能修改自己的管理员权限") from exc
    except admin_user_service.LastAdminError as exc:
        raise HTTPException(status_code=409, detail="至少保留一个管理员") from exc
    last_active_at = await admin_user_service.last_active_at(session, user.id)
    await session.commit()
    return _detail(user, last_active_at)


@router.post("/{user_id}/password", status_code=204, summary="重置密码")
async def reset_password(
    user_id: uuid.UUID,
    payload: AdminPasswordResetRequest,
    session: SessionDep,
    _admin: AdminUser,
) -> None:
    try:
        await admin_user_service.reset_password(
            session,
            user_id=user_id,
            new_password=payload.new_password,
        )
    except admin_user_service.AdminUserNotFoundError as exc:
        raise not_found() from exc
    await session.commit()


def _detail(user: User, last_active_at: datetime | None) -> AdminUserDetail:
    return AdminUserDetail(
        id=user.id,
        username=user.username,
        role=user.role,
        status=user.status,
        created_at=user.created_at,
        last_active_at=last_active_at,
    )
