import pytest
from pydantic import ValidationError

from app.api.services.admin_question_service import (
    QuestionValidationError,
    _normalize_content,
    _normalize_note,
)
from app.shared.dto.admin import AdminUserCreateRequest, AdminUserStatusRequest
from app.shared.enums import QuestionType, UserRole, UserStatus


def test_single_choice_normalization() -> None:
    stem, options, answer = _normalize_content(
        stem="  题干  ",
        question_type=QuestionType.SINGLE_CHOICE,
        options={"B": " 乙 ", "A": "甲"},
        answer_text="b",
    )
    assert stem == "题干"
    assert options == {"A": "甲", "B": "乙"}
    assert answer == "B"


@pytest.mark.parametrize(
    ("options", "answer"),
    [
        ({"A": "甲"}, "A"),
        ({"A": "甲", "C": "丙"}, "A"),
        ({"A": "甲", "B": "乙"}, "C"),
        ({"A": "甲", "B": ""}, "A"),
    ],
)
def test_single_choice_rejects_invalid_options(options: dict[str, str], answer: str) -> None:
    with pytest.raises(QuestionValidationError):
        _normalize_content(
            stem="题干",
            question_type=QuestionType.SINGLE_CHOICE,
            options=options,
            answer_text=answer,
        )


def test_short_answer_rejects_options() -> None:
    with pytest.raises(QuestionValidationError):
        _normalize_content(
            stem="题干",
            question_type=QuestionType.SHORT_ANSWER,
            options={"A": "甲"},
            answer_text="参考答案",
        )


def test_note_normalization() -> None:
    assert _normalize_note("  备注  ") == "备注"
    assert _normalize_note("   ") is None
    assert _normalize_note(None) is None


def test_admin_user_username_validation() -> None:
    payload = AdminUserCreateRequest(
        username="  student01  ",
        password="secret123",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
    )
    assert payload.username == "student01"

    with pytest.raises(ValidationError):
        AdminUserCreateRequest(username="st udent", password="secret123")
    with pytest.raises(ValidationError):
        AdminUserStatusRequest(status="unknown")
