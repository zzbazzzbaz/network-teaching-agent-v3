import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import question_repositories
from app.repositories.models import Question, QuestionAttempt, QuestionType
from app.repositories.question_repositories import QuestionScope

logger = logging.getLogger(__name__)


class QuestionNotFoundError(Exception):
    pass


async def list_questions(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    scope: QuestionScope,
    query: str | None,
    question_type: QuestionType | None,
    limit: int,
    offset: int,
) -> tuple[list[Question], int]:
    return await question_repositories.list_questions(
        session,
        user_id=user_id,
        scope=scope,
        query=query,
        question_type=question_type,
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
