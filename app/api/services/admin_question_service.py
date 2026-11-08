import uuid
from datetime import UTC, date, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.repositories import question_repositories
from app.api.repositories.models import Question, QuestionAttempt, QuestionType
from app.api.repositories.question_repositories import (
    AdminQuestionScope,
    QuestionAttemptStats,
)

_LETTERS = "ABCDEF"
_CONTENT_FIELDS = {"stem", "question_type", "options", "answer_text"}


class AdminQuestionError(Exception):
    pass


class AdminQuestionNotFoundError(AdminQuestionError):
    pass


class QuestionValidationError(AdminQuestionError):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class StudentQuestionError(AdminQuestionError):
    pass


class QuestionHasAttemptsError(AdminQuestionError):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


def _normalize_content(
    *,
    stem: str,
    question_type: QuestionType,
    options: dict[str, str] | None,
    answer_text: str,
) -> tuple[str, dict[str, str] | None, str]:
    normalized_stem = stem.strip()
    if not normalized_stem:
        raise QuestionValidationError("题干不能为空")

    normalized_answer = answer_text.strip()
    if not normalized_answer:
        raise QuestionValidationError("参考答案不能为空")

    if question_type is QuestionType.SINGLE_CHOICE:
        if not options:
            raise QuestionValidationError("单选题必须提供选项")
        if not 2 <= len(options) <= 6:
            raise QuestionValidationError("单选题必须提供 2-6 个选项")
        keys = sorted(options)
        expected = list(_LETTERS[: len(keys)])
        if keys != expected:
            raise QuestionValidationError("选项必须从 A 开始连续编号")
        normalized_options: dict[str, str] = {}
        for key in keys:
            value = options[key].strip()
            if not value:
                raise QuestionValidationError("选项内容不能为空")
            normalized_options[key] = value
        normalized_answer = normalized_answer.upper()
        if normalized_answer not in normalized_options:
            raise QuestionValidationError("单选题答案必须是选项之一")
        return normalized_stem, normalized_options, normalized_answer

    if options:
        raise QuestionValidationError("简答题不能包含选项")
    return normalized_stem, None, normalized_answer


def _normalize_note(note: str | None) -> str | None:
    if note is None:
        return None
    normalized = note.strip()
    return normalized or None


async def list_questions(
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
) -> tuple[list[tuple[Question, str | None, QuestionAttemptStats]], int]:
    questions, total = await question_repositories.list_questions_admin(
        session,
        scope=scope,
        user_id=user_id,
        query=query.strip() if query else None,
        question_type=question_type,
        created_date=created_date,
        include_deleted=include_deleted,
        limit=limit,
        offset=offset,
    )
    stats = await question_repositories.attempt_stats(
        session,
        question_ids=[question.id for question in questions],
    )
    owner_ids = {question.user_id for question in questions if question.user_id is not None}
    owners = await question_repositories.owner_usernames(session, user_ids=owner_ids)
    items = [
        (
            question,
            owners.get(question.user_id) if question.user_id is not None else None,
            stats.get(
                question.id,
                QuestionAttemptStats(attempt_count=0, student_count=0, correct_count=0),
            ),
        )
        for question in questions
    ]
    return items, total


async def get_question(session: AsyncSession, question_id: uuid.UUID) -> Question:
    question = await question_repositories.get_question(session, question_id)
    if question is None or question.deleted_at is not None:
        raise AdminQuestionNotFoundError
    return question


async def get_detail(
    session: AsyncSession,
    question_id: uuid.UUID,
) -> tuple[Question, str | None, QuestionAttemptStats]:
    question = await get_question(session, question_id)
    stats = await question_repositories.get_attempt_stats(
        session,
        question_id=question.id,
    )
    owner_username = None
    if question.user_id is not None:
        owners = await question_repositories.owner_usernames(
            session,
            user_ids={question.user_id},
        )
        owner_username = owners.get(question.user_id)
    return question, owner_username, stats


async def create_public_question(
    session: AsyncSession,
    *,
    stem: str,
    question_type: QuestionType,
    options: dict[str, str] | None,
    answer_text: str,
    note: str | None,
) -> Question:
    normalized_stem, normalized_options, normalized_answer = _normalize_content(
        stem=stem,
        question_type=question_type,
        options=options,
        answer_text=answer_text,
    )
    return await question_repositories.create_question(
        session,
        user_id=None,
        stem=normalized_stem,
        question_type=question_type,
        options=normalized_options,
        answer_text=normalized_answer,
        note=_normalize_note(note),
    )


async def update_question(
    session: AsyncSession,
    *,
    question_id: uuid.UUID,
    fields_set: set[str],
    stem: str | None,
    question_type: QuestionType | None,
    options: dict[str, str] | None,
    answer_text: str | None,
    note: str | None,
) -> Question:
    question = await get_question(session, question_id)
    if question.user_id is not None:
        raise StudentQuestionError

    has_attempts = await question_repositories.has_attempts(
        session,
        question_id=question.id,
    )
    if has_attempts and fields_set & _CONTENT_FIELDS:
        raise QuestionHasAttemptsError("已有作答记录，题目内容不可修改")  # noqa: RUF001

    update_note = "note" in fields_set
    normalized_note = _normalize_note(note) if update_note else None

    if has_attempts:
        return await question_repositories.update_question(
            session,
            question,
            note=normalized_note,
            update_note=update_note,
        )

    next_stem = stem if "stem" in fields_set and stem is not None else question.stem
    next_type = (
        question_type
        if "question_type" in fields_set and question_type is not None
        else question.question_type
    )
    next_options = options if "options" in fields_set else question.options
    next_answer = (
        answer_text
        if "answer_text" in fields_set and answer_text is not None
        else question.answer_text
    )
    normalized_stem, normalized_options, normalized_answer = _normalize_content(
        stem=next_stem,
        question_type=next_type,
        options=next_options,
        answer_text=next_answer,
    )
    return await question_repositories.update_question(
        session,
        question,
        stem=normalized_stem,
        question_type=next_type,
        options=normalized_options,
        update_options=True,
        answer_text=normalized_answer,
        note=normalized_note,
        update_note=update_note,
    )


async def delete_question(session: AsyncSession, question_id: uuid.UUID) -> None:
    question = await get_question(session, question_id)
    if question.user_id is not None:
        raise StudentQuestionError
    if await question_repositories.has_attempts(session, question_id=question.id):
        raise QuestionHasAttemptsError("已有作答记录，题目不可删除")  # noqa: RUF001
    await question_repositories.soft_delete_question(
        session,
        question,
        deleted_at=datetime.now(UTC),
    )


async def list_attempts(
    session: AsyncSession,
    *,
    question_id: uuid.UUID,
    limit: int,
    offset: int,
) -> tuple[Question, list[tuple[QuestionAttempt, str, str]], int]:
    question = await get_question(session, question_id)
    attempts, total = await question_repositories.list_attempts_admin(
        session,
        question_id=question.id,
        limit=limit,
        offset=offset,
    )
    return question, attempts, total
