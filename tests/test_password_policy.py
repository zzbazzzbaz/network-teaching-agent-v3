import pytest
from pydantic import ValidationError

from app.api.core.security import default_password, hash_password, verify_password
from app.shared.dto.auth import ChangePasswordRequest


def test_default_password_appends_suffix() -> None:
    assert default_password("student01") == "student01000000"
    assert default_password("zhangsan") == "zhangsan000000"


def test_password_hash_roundtrip() -> None:
    password_hash = hash_password("new-secret")
    assert verify_password("new-secret", password_hash)
    assert not verify_password("student01000000", password_hash)


def test_change_password_request_length_validation() -> None:
    payload = ChangePasswordRequest(
        old_password="student01000000",
        new_password="new-secret",
    )
    assert payload.new_password == "new-secret"

    with pytest.raises(ValidationError):
        ChangePasswordRequest(old_password="12345", new_password="new-secret")
    with pytest.raises(ValidationError):
        ChangePasswordRequest(old_password="student01000000", new_password="12345")
