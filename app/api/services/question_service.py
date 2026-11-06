import logging
import uuid
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.repositories import question_repositories
from app.api.repositories.models import ChatSession, Question, QuestionAttempt, QuestionType
from app.api.repositories.question_repositories import QuestionScope

logger = logging.getLogger(__name__)


class QuestionNotFoundError(Exception):
    pass


class SessionNotFoundError(Exception):
    pass


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
    return await question_repositories.list_questions(
        session,
        user_id=user_id,
        scope=scope,
        query=query,
        question_type=question_type,
        date=date,
        limit=limit,
        offset=offset,
    )


async def get_question(
    session: AsyncSession,
    question_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Question:
    question = await question_repositories.get_question(session, question_id)
    if question is None:
        logger.info("question not found: question_id=%s", question_id)
        raise QuestionNotFoundError
    if question.deleted_at is not None:
        logger.info("question deleted: question_id=%s", question_id)
        raise QuestionNotFoundError
    if question.user_id is not None and question.user_id != user_id:
        logger.warning("question not visible: question_id=%s user_id=%s", question_id, user_id)
        raise QuestionNotFoundError
    return question


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
    return await question_repositories.create_question(
        session,
        user_id=user_id,
        stem=stem,
        question_type=question_type,
        options=options,
        answer_text=answer_text,
        note=note,
    )


async def list_attempts(
    session: AsyncSession,
    *,
    question_id: uuid.UUID,
    user_id: uuid.UUID,
    limit: int,
    offset: int,
) -> tuple[list[QuestionAttempt], int]:
    await get_question(session, question_id, user_id)
    return await question_repositories.list_attempts(
        session,
        user_id=user_id,
        question_id=question_id,
        limit=limit,
        offset=offset,
    )


async def get_question_with_attempts(
    session: AsyncSession,
    *,
    question_id: uuid.UUID,
    user_id: uuid.UUID,
    limit: int,
) -> tuple[Question, list[QuestionAttempt], int]:
    question = await get_question(session, question_id, user_id)
    attempts, total = await question_repositories.list_attempts(
        session,
        user_id=user_id,
        question_id=question_id,
        limit=limit,
        offset=0,
    )
    return question, attempts, total


async def record_answer(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    tool_call_id: str,
    stem: str,
    question_type: QuestionType,
    options: dict[str, str] | None,
    answer_text: str,
    answer: str,
) -> None:
    chat_session = await session.get(ChatSession, session_id)
    if chat_session is None or chat_session.user_id != user_id:
        logger.info("answer session not found: session_id=%s user_id=%s", session_id, user_id)
        raise SessionNotFoundError

    existing = await question_repositories.get_attempt_by_tool_call(
        session,
        user_id=user_id,
        tool_call_id=tool_call_id,
    )
    if existing is not None:
        logger.info("answer replayed: tool_call_id=%s attempt_id=%s", tool_call_id, existing.id)
        return

    question = await create_question(
        session,
        user_id=user_id,
        stem=stem,
        question_type=question_type,
        options=options,
        answer_text=answer_text,
        note=None,
    )
    await question_repositories.create_attempt(
        session,
        user_id=user_id,
        question_id=question.id,
        session_id=session_id,
        tool_call_id=tool_call_id,
        answer_text=answer,
    )
