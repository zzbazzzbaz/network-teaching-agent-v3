import uuid
from datetime import date as Date
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from app.api.dependencies import AdminUser, SessionDep
from app.api.repositories.models import Question, QuestionType
from app.api.repositories.question_repositories import (
    AdminQuestionScope,
    QuestionAttemptStats,
)
from app.api.services import admin_question_service
from app.shared.dto.admin import (
    AdminAttemptItem,
    AdminAttemptListResponse,
    AdminQuestionCreateRequest,
    AdminQuestionDetail,
    AdminQuestionItem,
    AdminQuestionListResponse,
    AdminQuestionUpdateRequest,
)
from app.shared.errors import not_found

router = APIRouter(prefix="/questions", tags=["管理-题目"])


def _correct_rate(question: Question, stats: QuestionAttemptStats) -> float | None:
    if question.question_type is not QuestionType.SINGLE_CHOICE:
        return None
    if stats.attempt_count <= 0:
        return None
    return round(stats.correct_count / stats.attempt_count, 4)


def _to_item(
    question: Question,
    owner_username: str | None,
    stats: QuestionAttemptStats,
) -> AdminQuestionItem:
    return AdminQuestionItem(
        id=question.id,
        user_id=question.user_id,
        owner_username=owner_username,
        is_public=question.user_id is None,
        stem=question.stem,
        question_type=question.question_type,
        options=question.options,
        answer_text=question.answer_text,
        note=question.note,
        created_at=question.created_at,
        attempt_count=stats.attempt_count,
        student_count=stats.student_count,
        correct_rate=_correct_rate(question, stats),
    )


def _validation_error(exc: admin_question_service.QuestionValidationError) -> HTTPException:
    return HTTPException(status_code=422, detail=exc.detail)


@router.get("", response_model=AdminQuestionListResponse, summary="题目列表")
async def list_questions(
    session: SessionDep,
    _admin: AdminUser,
    scope: AdminQuestionScope = AdminQuestionScope.ALL,
    user_id: uuid.UUID | None = None,
    q: Annotated[str | None, Query(max_length=200)] = None,
    question_type: QuestionType | None = None,
    date: Date | None = None,
    include_deleted: bool = False,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AdminQuestionListResponse:
    if scope is AdminQuestionScope.USER and user_id is None:
        raise HTTPException(status_code=422, detail="user_id 必填")
    items, total = await admin_question_service.list_questions(
        session,
        scope=scope,
        user_id=user_id,
        query=q,
        question_type=question_type,
        created_date=date,
        include_deleted=include_deleted,
        limit=limit,
        offset=offset,
    )
    return AdminQuestionListResponse(
        items=[_to_item(question, owner, stats) for question, owner, stats in items],
        total=total,
    )


@router.post(
    "",
    response_model=AdminQuestionDetail,
    status_code=201,
    summary="新建公共题",
)
async def create_question(
    payload: AdminQuestionCreateRequest,
    session: SessionDep,
    _admin: AdminUser,
) -> AdminQuestionDetail:
    try:
        question = await admin_question_service.create_public_question(
            session,
            stem=payload.stem,
            question_type=payload.question_type,
            options=payload.options,
            answer_text=payload.answer_text,
            note=payload.note,
        )
    except admin_question_service.QuestionValidationError as exc:
        raise _validation_error(exc) from exc
    await session.commit()
    return _detail(question, None, QuestionAttemptStats(0, 0, 0))


@router.get("/{question_id}", response_model=AdminQuestionDetail, summary="题目详情")
async def get_question(
    question_id: uuid.UUID,
    session: SessionDep,
    _admin: AdminUser,
) -> AdminQuestionDetail:
    try:
        question, owner_username, stats = await admin_question_service.get_detail(
            session,
            question_id,
        )
    except admin_question_service.AdminQuestionNotFoundError as exc:
        raise not_found() from exc
    return _detail(question, owner_username, stats)


@router.patch("/{question_id}", response_model=AdminQuestionDetail, summary="编辑公共题")
async def update_question(
    question_id: uuid.UUID,
    payload: AdminQuestionUpdateRequest,
    session: SessionDep,
    _admin: AdminUser,
) -> AdminQuestionDetail:
    fields = payload.model_fields_set
    try:
        question = await admin_question_service.update_question(
            session,
            question_id=question_id,
            fields_set=fields,
            stem=payload.stem if "stem" in fields else None,
            question_type=payload.question_type if "question_type" in fields else None,
            options=payload.options if "options" in fields else None,
            answer_text=payload.answer_text if "answer_text" in fields else None,
            note=payload.note if "note" in fields else None,
        )
    except admin_question_service.AdminQuestionNotFoundError as exc:
        raise not_found() from exc
    except admin_question_service.StudentQuestionError as exc:
        raise HTTPException(status_code=409, detail="学生题目不可编辑") from exc
    except admin_question_service.QuestionHasAttemptsError as exc:
        raise HTTPException(status_code=409, detail=exc.detail) from exc
    except admin_question_service.QuestionValidationError as exc:
        raise _validation_error(exc) from exc
    await session.commit()
    _, owner_username, stats = await admin_question_service.get_detail(session, question.id)
    return _detail(question, owner_username, stats)


@router.delete("/{question_id}", status_code=204, summary="删除公共题")
async def delete_question(
    question_id: uuid.UUID,
    session: SessionDep,
    _admin: AdminUser,
) -> None:
    try:
        await admin_question_service.delete_question(session, question_id)
    except admin_question_service.AdminQuestionNotFoundError as exc:
        raise not_found() from exc
    except admin_question_service.StudentQuestionError as exc:
        raise HTTPException(status_code=409, detail="学生题目不可编辑") from exc
    except admin_question_service.QuestionHasAttemptsError as exc:
        raise HTTPException(status_code=409, detail=exc.detail) from exc
    await session.commit()


@router.get(
    "/{question_id}/attempts",
    response_model=AdminAttemptListResponse,
    summary="跨学生作答记录",
)
async def list_attempts(
    question_id: uuid.UUID,
    session: SessionDep,
    _admin: AdminUser,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AdminAttemptListResponse:
    try:
        question, attempts, total = await admin_question_service.list_attempts(
            session,
            question_id=question_id,
            limit=limit,
            offset=offset,
        )
    except admin_question_service.AdminQuestionNotFoundError as exc:
        raise not_found() from exc

    items = [
        AdminAttemptItem(
            id=attempt.id,
            user_id=attempt.user_id,
            username=username,
            answer_text=attempt.answer_text,
            is_correct=(
                attempt.answer_text == question.answer_text
                if question.question_type is QuestionType.SINGLE_CHOICE
                else None
            ),
            created_at=attempt.created_at,
            session_id=attempt.session_id,
            session_title=session_title,
        )
        for attempt, username, session_title in attempts
    ]
    return AdminAttemptListResponse(items=items, total=total)


def _detail(
    question: Question,
    owner_username: str | None,
    stats: QuestionAttemptStats,
) -> AdminQuestionDetail:
    return AdminQuestionDetail(
        id=question.id,
        user_id=question.user_id,
        owner_username=owner_username,
        is_public=question.user_id is None,
        stem=question.stem,
        question_type=question.question_type,
        options=question.options,
        answer_text=question.answer_text,
        note=question.note,
        created_at=question.created_at,
        attempt_total=stats.attempt_count,
        student_count=stats.student_count,
    )
