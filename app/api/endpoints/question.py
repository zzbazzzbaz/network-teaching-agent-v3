import uuid
from typing import Annotated

from fastapi import APIRouter, Query

from app.api.dependencies import CurrentUser, SessionDep
from app.api.endpoints.schemas.question import (
    AttemptListResponse,
    AttemptResponse,
    QuestionListResponse,
    QuestionResponse,
)
from app.api.errors import not_found
from app.repositories.models import QuestionType
from app.repositories.question_repositories import QuestionScope
from app.services import question_service

router = APIRouter(prefix="/questions", tags=["题目"])


@router.get("", response_model=QuestionListResponse, summary="题目列表")
async def list_questions(
    session: SessionDep,
    current_user: CurrentUser,
    query: Annotated[str | None, Query(max_length=200)] = None,
    question_type: QuestionType | None = None,
    scope: QuestionScope = QuestionScope.ALL,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> QuestionListResponse:
    questions, total = await question_service.list_questions(
        session,
        user_id=current_user.id,
        scope=scope,
        query=query,
        question_type=question_type,
        limit=limit,
        offset=offset,
    )
    return QuestionListResponse(
        items=[QuestionResponse.model_validate(question) for question in questions],
        total=total,
    )


@router.get("/{question_id}", response_model=QuestionResponse, summary="题目详情")
async def get_question(
    question_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> QuestionResponse:
    try:
        question = await question_service.get_question(session, question_id, current_user.id)
    except question_service.QuestionNotFoundError as exc:
        raise not_found() from exc
    return QuestionResponse.model_validate(question)


@router.get(
    "/{question_id}/attempts",
    response_model=AttemptListResponse,
    summary="题目作答记录",
)
async def list_attempts(
    question_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AttemptListResponse:
    try:
        attempts, total = await question_service.list_attempts(
            session,
            question_id=question_id,
            user_id=current_user.id,
            limit=limit,
            offset=offset,
        )
    except question_service.QuestionNotFoundError as exc:
        raise not_found() from exc
    return AttemptListResponse(
        items=[AttemptResponse.model_validate(attempt) for attempt in attempts],
        total=total,
    )
