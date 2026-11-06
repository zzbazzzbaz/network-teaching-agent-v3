from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.shared.constants import APP_TIMEZONE

APP_TZ = ZoneInfo(APP_TIMEZONE)


def local_day_start(day: date) -> datetime:
    return datetime.combine(day, time.min, tzinfo=APP_TZ).astimezone(UTC)


def local_day_end(day: date) -> datetime:
    return local_day_start(day + timedelta(days=1))
