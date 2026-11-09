import uuid
from datetime import UTC, date, datetime

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement
from sqlmodel import col, select

from app.api.repositories.models import Question, QuestionType
from app.shared.time import local_day_end, local_day_start


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _answered_date_filters(day: date) -> list[ColumnElement[bool]]:
    return [
        col(Question.answered_at) >= local_day_start(day),
        col(Question.answered_at) < local_day_end(day),
    ]


def _record_filters(
    user_id: uuid.UUID,
    query: str | None,
    question_type: QuestionType | None,
    date: date | None,
) -> list[ColumnElement[bool]]:
    filters: list[ColumnElement[bool]] = [col(Question.user_id) == user_id]
    if question_type is not None:
        filters.append(col(Question.question_type) == question_type)
    if query:
        filters.append(col(Question.stem).ilike(f"%{_escape_like(query)}%", escape="\\"))
    if date is not None:
        filters.extend(_answered_date_filters(date))
    return filters


async def list_records(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    query: str | None,
    question_type: QuestionType | None,
    date: date | None,
    limit: int,
    offset: int,
) -> tuple[list[Question], int]:
    filters = _record_filters(user_id, query, question_type, date)
    total = await session.scalar(select(func.count()).select_from(Question).where(*filters))
    statement = (
        select(Question)
        .where(*filters)
        .order_by(col(Question.answered_at).desc(), col(Question.id))
        .limit(limit)
        .offset(offset)
    )
    items = (await session.execute(statement)).scalars().all()
    return list(items), int(total or 0)


async def get_record(
    session: AsyncSession,
    *,
    question_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Question | None:
    statement = select(Question).where(
        col(Question.id) == question_id,
        col(Question.user_id) == user_id,
    )
    return await session.scalar(statement)


async def get_by_tool_call(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    tool_call_id: str,
) -> Question | None:
    statement = select(Question).where(
        col(Question.user_id) == user_id,
        col(Question.tool_call_id) == tool_call_id,
    )
    return await session.scalar(statement)


async def create_record(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    tool_call_id: str,
    question_type: QuestionType,
    stem: str,
    options: dict[str, str] | None,
    correct_answer: str,
    student_answer: str,
) -> bool:
    statement = (
        insert(Question)
        .values(
            id=uuid.uuid4(),
            user_id=user_id,
            session_id=session_id,
            tool_call_id=tool_call_id,
            question_type=question_type,
            stem=stem,
            options=options,
            correct_answer=correct_answer,
            student_answer=student_answer,
            answered_at=datetime.now(UTC),
        )
        .on_conflict_do_nothing(index_elements=["user_id", "tool_call_id"])
        .returning(col(Question.id))
    )
    record_id = await session.scalar(statement)
    return record_id is not None


async def count_answers(session: AsyncSession, *, user_id: uuid.UUID) -> int:
    statement = (
        select(func.count())
        .select_from(Question)
        .where(col(Question.user_id) == user_id)
    )
    total = await session.scalar(statement)
    return int(total or 0)
