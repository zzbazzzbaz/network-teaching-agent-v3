import uuid
from datetime import UTC, date, datetime, time, timedelta, timezone
from enum import StrEnum

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.api.repositories.models import Question, QuestionAttempt, QuestionType
from app.shared.constants import STATS_TIMEZONE

_LOCAL_TZ = timezone(timedelta(hours=8), STATS_TIMEZONE)


class QuestionScope(StrEnum):
    PUBLIC = "public"
    MINE = "mine"
    ALL = "all"


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _created_date_filters(day: date) -> list[ColumnElement[bool]]:
    start_at = datetime.combine(day, time.min, tzinfo=_LOCAL_TZ).astimezone(UTC)
    end_at = datetime.combine(day + timedelta(days=1), time.min, tzinfo=_LOCAL_TZ).astimezone(UTC)
    return [Question.created_at >= start_at, Question.created_at < end_at]


def _question_filters(
    user_id: uuid.UUID,
    scope: QuestionScope,
    query: str | None,
    question_type: QuestionType | None,
    date: date | None,
) -> list[ColumnElement[bool]]:
    filters: list[ColumnElement[bool]] = [Question.deleted_at.is_(None)]
    if scope is QuestionScope.PUBLIC:
        filters.append(Question.user_id.is_(None))
    elif scope is QuestionScope.MINE:
        filters.append(Question.user_id == user_id)
    else:
        filters.append(or_(Question.user_id.is_(None), Question.user_id == user_id))
    if question_type is not None:
        filters.append(Question.question_type == question_type)
    if query:
        filters.append(Question.stem.ilike(f"%{_escape_like(query)}%", escape="\\"))
    if date is not None:
        filters.extend(_created_date_filters(date))
    return filters


async def list_questions(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    scope: QuestionScope,
    query: str | None,
    question_type: QuestionType | None,
    date: date | None,
    limit: int,
    offset: int,
) -> tuple[list[Question], int]:
    filters = _question_filters(user_id, scope, query, question_type, date)
    total = await session.scalar(select(func.count()).select_from(Question).where(*filters))
    statement = (
        select(Question)
        .where(*filters)
        .order_by(Question.created_at.desc(), Question.id)
        .limit(limit)
        .offset(offset)
    )
    items = (await session.execute(statement)).scalars().all()
    return list(items), total or 0


async def get_question(session: AsyncSession, question_id: uuid.UUID) -> Question | None:
    return await session.get(Question, question_id)


async def create_question(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    stem: str,
    question_type: QuestionType,
    options: dict[str, str] | None,
    answer_text: str,
    note: str | None,
) -> Question:
    question = Question(
        user_id=user_id,
        stem=stem,
        question_type=question_type,
        options=options,
        answer_text=answer_text,
        note=note,
    )
    session.add(question)
    await session.flush()
    return question


async def get_attempt_by_tool_call(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    tool_call_id: str,
) -> QuestionAttempt | None:
    statement = (
        select(QuestionAttempt)
        .where(
            QuestionAttempt.user_id == user_id,
            QuestionAttempt.tool_call_id == tool_call_id,
        )
        .order_by(QuestionAttempt.created_at.desc())
        .limit(1)
    )
    return await session.scalar(statement)


async def create_attempt(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    question_id: uuid.UUID,
    session_id: uuid.UUID,
    tool_call_id: str | None,
    answer_text: str,
) -> QuestionAttempt:
    attempt = QuestionAttempt(
        user_id=user_id,
        question_id=question_id,
        session_id=session_id,
        tool_call_id=tool_call_id,
        answer_text=answer_text,
    )
    session.add(attempt)
    await session.flush()
    return attempt


async def count_attempts(session: AsyncSession, *, user_id: uuid.UUID) -> int:
    statement = (
        select(func.count()).select_from(QuestionAttempt).where(QuestionAttempt.user_id == user_id)
    )
    total = await session.scalar(statement)
    return int(total or 0)


async def list_attempts(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    question_id: uuid.UUID,
    limit: int,
    offset: int,
) -> tuple[list[QuestionAttempt], int]:
    filters = [QuestionAttempt.user_id == user_id, QuestionAttempt.question_id == question_id]
    total = await session.scalar(select(func.count()).select_from(QuestionAttempt).where(*filters))
    statement = (
        select(QuestionAttempt)
        .where(*filters)
        .order_by(QuestionAttempt.created_at.desc(), QuestionAttempt.id)
        .limit(limit)
        .offset(offset)
    )
    items = (await session.execute(statement)).scalars().all()
    return list(items), total or 0
