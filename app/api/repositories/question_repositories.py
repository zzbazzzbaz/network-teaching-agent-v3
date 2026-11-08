import uuid
from dataclasses import dataclass
from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement
from sqlmodel import col, or_, select

from app.api.repositories.models import (
    ChatSession,
    Question,
    QuestionAttempt,
    QuestionType,
    User,
)
from app.shared.constants import SESSION_PLACEHOLDER_TITLE
from app.shared.time import local_day_end, local_day_start


class QuestionScope(StrEnum):
    PUBLIC = "public"
    MINE = "mine"
    ALL = "all"


class AdminQuestionScope(StrEnum):
    PUBLIC = "public"
    USER = "user"
    ALL = "all"


@dataclass(frozen=True)
class QuestionAttemptStats:
    attempt_count: int
    student_count: int


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _created_date_filters(day: date) -> list[ColumnElement[bool]]:
    return [
        col(Question.created_at) >= local_day_start(day),
        col(Question.created_at) < local_day_end(day),
    ]


def _question_filters(
    user_id: uuid.UUID,
    scope: QuestionScope,
    query: str | None,
    question_type: QuestionType | None,
    date: date | None,
) -> list[ColumnElement[bool]]:
    filters: list[ColumnElement[bool]] = [col(Question.deleted_at).is_(None)]
    if scope is QuestionScope.PUBLIC:
        filters.append(col(Question.user_id).is_(None))
    elif scope is QuestionScope.MINE:
        filters.append(col(Question.user_id) == user_id)
    else:
        filters.append(or_(col(Question.user_id).is_(None), col(Question.user_id) == user_id))
    if question_type is not None:
        filters.append(col(Question.question_type) == question_type)
    if query:
        filters.append(col(Question.stem).ilike(f"%{_escape_like(query)}%", escape="\\"))
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
        .order_by(col(Question.created_at).desc(), col(Question.id))
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
    user_id: uuid.UUID | None,
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
            col(QuestionAttempt.user_id) == user_id,
            col(QuestionAttempt.tool_call_id) == tool_call_id,
        )
        .order_by(col(QuestionAttempt.created_at).desc())
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
        select(func.count())
        .select_from(QuestionAttempt)
        .where(col(QuestionAttempt.user_id) == user_id)
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
    filters: list[ColumnElement[bool]] = [
        col(QuestionAttempt.user_id) == user_id,
        col(QuestionAttempt.question_id) == question_id,
    ]
    total = await session.scalar(select(func.count()).select_from(QuestionAttempt).where(*filters))
    statement = (
        select(QuestionAttempt)
        .where(*filters)
        .order_by(col(QuestionAttempt.created_at).desc(), col(QuestionAttempt.id))
        .limit(limit)
        .offset(offset)
    )
    items = (await session.execute(statement)).scalars().all()
    return list(items), total or 0


async def list_questions_admin(
    session: AsyncSession,
    *,
    scope: AdminQuestionScope,
    user_id: uuid.UUID | None,
    query: str | None,
    question_type: QuestionType | None,
    created_date: date | None,
    include_deleted: bool,
    limit: int,
    offset: int,
) -> tuple[list[Question], int]:
    filters: list[ColumnElement[bool]] = []
    if include_deleted:
        filters.append(
            or_(
                col(Question.deleted_at).is_(None),
                col(Question.user_id).is_(None),
            )
        )
    else:
        filters.append(col(Question.deleted_at).is_(None))
    if scope is AdminQuestionScope.PUBLIC:
        filters.append(col(Question.user_id).is_(None))
    elif scope is AdminQuestionScope.USER and user_id is not None:
        filters.append(col(Question.user_id) == user_id)
    if question_type is not None:
        filters.append(col(Question.question_type) == question_type)
    if query:
        filters.append(col(Question.stem).ilike(f"%{_escape_like(query)}%", escape="\\"))
    if created_date is not None:
        filters.extend(_created_date_filters(created_date))

    total = await session.scalar(select(func.count()).select_from(Question).where(*filters))
    statement = (
        select(Question)
        .where(*filters)
        .order_by(col(Question.created_at).desc(), col(Question.id))
        .limit(limit)
        .offset(offset)
    )
    items = (await session.execute(statement)).scalars().all()
    return list(items), int(total or 0)


async def attempt_stats(
    session: AsyncSession,
    *,
    question_ids: list[uuid.UUID],
) -> dict[uuid.UUID, QuestionAttemptStats]:
    if not question_ids:
        return {}

    statement = (
        select(
            col(QuestionAttempt.question_id),
            func.count().label("attempt_count"),
            func.count(func.distinct(col(QuestionAttempt.user_id))).label("student_count"),
        )
        .where(col(QuestionAttempt.question_id).in_(question_ids))
        .group_by(col(QuestionAttempt.question_id))
    )
    rows = (await session.execute(statement)).all()
    return {
        row[0]: QuestionAttemptStats(
            attempt_count=int(row[1]),
            student_count=int(row[2]),
        )
        for row in rows
    }


async def get_attempt_stats(
    session: AsyncSession,
    *,
    question_id: uuid.UUID,
) -> QuestionAttemptStats:
    stats = await attempt_stats(session, question_ids=[question_id])
    return stats.get(
        question_id,
        QuestionAttemptStats(attempt_count=0, student_count=0),
    )


async def owner_usernames(
    session: AsyncSession,
    *,
    user_ids: set[uuid.UUID],
) -> dict[uuid.UUID, str]:
    if not user_ids:
        return {}
    statement = select(col(User.id), col(User.username)).where(col(User.id).in_(user_ids))
    rows = (await session.execute(statement)).all()
    return {row[0]: row[1] for row in rows}


async def has_attempts(session: AsyncSession, *, question_id: uuid.UUID) -> bool:
    statement = select(func.count()).select_from(QuestionAttempt).where(
        col(QuestionAttempt.question_id) == question_id
    )
    total = await session.scalar(statement)
    return bool(total)


async def update_question(
    session: AsyncSession,
    question: Question,
    *,
    stem: str | None = None,
    question_type: QuestionType | None = None,
    options: dict[str, str] | None = None,
    update_options: bool = False,
    answer_text: str | None = None,
    note: str | None = None,
    update_note: bool = False,
) -> Question:
    if stem is not None:
        question.stem = stem
    if question_type is not None:
        question.question_type = question_type
    if update_options:
        question.options = options
    if answer_text is not None:
        question.answer_text = answer_text
    if update_note:
        question.note = note
    session.add(question)
    await session.flush()
    return question


async def soft_delete_question(
    session: AsyncSession,
    question: Question,
    *,
    deleted_at: datetime,
) -> None:
    question.deleted_at = deleted_at
    session.add(question)
    await session.flush()


async def list_attempts_admin(
    session: AsyncSession,
    *,
    question_id: uuid.UUID,
    limit: int,
    offset: int,
) -> tuple[list[tuple[QuestionAttempt, str, str]], int]:
    filters: list[ColumnElement[bool]] = [
        col(QuestionAttempt.question_id) == question_id,
    ]
    total = await session.scalar(select(func.count()).select_from(QuestionAttempt).where(*filters))
    statement = (
        select(
            QuestionAttempt,
            col(User.username),
            col(ChatSession.title),
        )
        .join(User, col(User.id) == col(QuestionAttempt.user_id))
        .outerjoin(ChatSession, col(ChatSession.id) == col(QuestionAttempt.session_id))
        .where(*filters)
        .order_by(col(QuestionAttempt.created_at).desc(), col(QuestionAttempt.id))
        .limit(limit)
        .offset(offset)
    )
    rows = (await session.execute(statement)).all()
    items = [
        (
            row[0],
            row[1],
            row[2] or SESSION_PLACEHOLDER_TITLE,
        )
        for row in rows
    ]
    return items, int(total or 0)
