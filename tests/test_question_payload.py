from typing import Any

import pytest
from pydantic import ValidationError

from app.shared.dto.internal_question import QuestionPayload
from app.shared.enums import QuestionType


def _choice(**overrides: Any) -> dict[str, Any]:
    data: dict[str, Any] = {
        "question_type": QuestionType.SINGLE_CHOICE,
        "stem": "题干",
        "options": ["甲", "乙"],
        "correct_option": "A",
    }
    data.update(overrides)
    return data


def test_single_choice_normalizes() -> None:
    payload = QuestionPayload(
        **_choice(
            stem="  题干  ",
            options=[" 甲 ", " 乙 "],
            correct_option=" b ",
        ),
    )
    assert payload.stem == "题干"
    assert payload.options == ["甲", "乙"]
    assert payload.correct_option == "B"


@pytest.mark.parametrize(
    ("options", "correct_option"),
    [
        (None, "A"),
        (["甲"], "A"),
        (["甲", "乙", "丙", "丁", "戊", "己", "庚"], "A"),
        (["甲", " "], "A"),
        (["甲", "乙"], "C"),
        (["甲", "乙"], None),
    ],
)
def test_single_choice_rejects_invalid(
    options: list[str] | None,
    correct_option: str | None,
) -> None:
    with pytest.raises(ValidationError):
        QuestionPayload(**_choice(options=options, correct_option=correct_option))


def test_single_choice_rejects_reference_answer() -> None:
    with pytest.raises(ValidationError):
        QuestionPayload(**_choice(reference_answer="参考答案"))


def test_short_answer_normalizes() -> None:
    payload = QuestionPayload(
        question_type=QuestionType.SHORT_ANSWER,
        stem=" 题干 ",
        reference_answer=" 参考答案 ",
    )
    assert payload.stem == "题干"
    assert payload.reference_answer == "参考答案"
    assert payload.options is None
    assert payload.correct_option is None


@pytest.mark.parametrize(
    "data",
    [
        {"stem": "题干", "options": ["甲", "乙"]},
        {"stem": "题干", "correct_option": "A"},
        {"stem": "题干", "reference_answer": "   "},
        {"stem": "   ", "reference_answer": "参考答案"},
        {"stem": "x" * 5001, "reference_answer": "参考答案"},
    ],
)
def test_short_answer_rejects_invalid(data: dict[str, Any]) -> None:
    with pytest.raises(ValidationError):
        QuestionPayload(question_type=QuestionType.SHORT_ANSWER, **data)
