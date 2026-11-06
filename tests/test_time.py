import uuid
from datetime import UTC, date, datetime

import pytest
from pydantic import ValidationError
from sqlalchemy import DateTime
from sqlalchemy.types import TypeDecorator
from sqlmodel import SQLModel

import app.api.repositories.models  # noqa: F401
from app.shared.constants import APP_TIMEZONE
from app.shared.dto.internal_usage import ReplyUsageReport
from app.shared.time import APP_TZ, local_day_end, local_day_start


def _base_type(column_type: object) -> object:
    if isinstance(column_type, TypeDecorator):
        return column_type.impl
    return column_type


def _is_timezone_aware(column_type: object) -> bool:
    base_type = _base_type(column_type)
    return isinstance(base_type, DateTime) and base_type.timezone is True


def test_app_timezone() -> None:
    assert APP_TIMEZONE == "Asia/Shanghai"
    assert APP_TZ.key == APP_TIMEZONE


def test_local_day_bounds() -> None:
    assert local_day_start(date(2026, 11, 6)) == datetime(2026, 11, 5, 16, tzinfo=UTC)
    assert local_day_end(date(2026, 11, 6)) == datetime(2026, 11, 6, 16, tzinfo=UTC)


def test_datetime_columns_are_timezone_aware() -> None:
    datetime_columns = [
        (table.name, column.name, column.type)
        for table in SQLModel.metadata.tables.values()
        for column in table.columns
        if isinstance(_base_type(column.type), DateTime)
    ]

    assert datetime_columns
    for table_name, column_name, column_type in datetime_columns:
        assert _is_timezone_aware(column_type), f"{table_name}.{column_name}"


def test_reply_usage_report_rejects_naive_datetime() -> None:
    with pytest.raises(ValidationError):
        ReplyUsageReport(
            session_id=uuid.uuid4(),
            reply_id="reply",
            started_at=datetime(2026, 11, 6, 10, 0, 0),
        )
