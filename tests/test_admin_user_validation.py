import pytest
from pydantic import ValidationError

from app.shared.dto.admin import AdminUserCreateRequest, AdminUserStatusRequest
from app.shared.enums import UserRole, UserStatus


def test_admin_user_username_validation() -> None:
    payload = AdminUserCreateRequest(username="  student01  ", status=UserStatus.ACTIVE)
    assert payload.username == "student01"
    assert payload.status is UserStatus.ACTIVE

    with pytest.raises(ValidationError):
        AdminUserCreateRequest(username="st udent")
    with pytest.raises(ValidationError):
        AdminUserCreateRequest.model_validate(
            {"username": "student01", "password": "secret123"},
        )
    with pytest.raises(ValidationError):
        AdminUserCreateRequest.model_validate(
            {"username": "student01", "role": UserRole.ADMIN},
        )
    with pytest.raises(ValidationError):
        AdminUserStatusRequest(status="unknown")
