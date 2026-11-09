import logging
import uuid
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.repositories import question_repositories
from app.api.repositories.models import ChatSession, Question, QuestionType

logger = logging.getLogger(__name__)


class QuestionNotFoundError(Exception):
    pass


class SessionNotFoundError(Exception):
    pass


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
    return await question_repositories.list_records(
        session,
        user_id=user_id,
        query=query,
        question_type=question_type,
        date=date,
        limit=limit,
        offset=offset,
    )


async def get_record(
    session: AsyncSession,
    *,
    question_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Question:
    record = await question_repositories.get_record(
        session,
        question_id=question_id,
        user_id=user_id,
    )
    if record is None:
        logger.info("question record not found: question_id=%s", question_id)
        raise QuestionNotFoundError
    return record


async def record_answer(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    tool_call_id: str,
    stem: str,
    question_type: QuestionType,
    options: dict[str, str] | None,
    correct_answer: str,
    student_answer: str,
) -> None:
    chat_session = await session.get(ChatSession, session_id)
    if chat_session is None or chat_session.user_id != user_id:
        logger.info(
            "answer session not found: session_id=%s user_id=%s",
            session_id,
            user_id,
        )
        raise SessionNotFoundError

    existing = await question_repositories.get_by_tool_call(
        session,
        user_id=user_id,
        tool_call_id=tool_call_id,
    )
    if existing is not None:
        logger.info("answer replayed: tool_call_id=%s", tool_call_id)
        return

    inserted = await question_repositories.create_record(
        session,
        user_id=user_id,
        session_id=session_id,
        tool_call_id=tool_call_id,
        question_type=question_type,
        stem=stem,
        options=options,
        correct_answer=correct_answer,
        student_answer=student_answer,
    )
    if not inserted:
        logger.info("answer replayed: tool_call_id=%s", tool_call_id)
