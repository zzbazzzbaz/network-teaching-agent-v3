import uuid
from datetime import date as Date
from typing import Annotated

from fastapi import APIRouter, Query

from app.api.dependencies import CurrentUser, SessionDep
from app.api.repositories.models import QuestionType
from app.api.services import question_service
from app.shared.dto.question import (
    QuestionRecordDetail,
    QuestionRecordItem,
    QuestionRecordListResponse,
)
from app.shared.errors import not_found

router = APIRouter(prefix="/questions", tags=["答题记录"])


@router.get("", response_model=QuestionRecordListResponse, summary="答题记录列表")
async def list_records(
    session: SessionDep,
    current_user: CurrentUser,
    query: Annotated[str | None, Query(max_length=200)] = None,
    question_type: QuestionType | None = None,
    date: Date | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> QuestionRecordListResponse:
    records, total = await question_service.list_records(
        session,
        user_id=current_user.id,
        query=query,
        question_type=question_type,
        date=date,
        limit=limit,
        offset=offset,
    )
    return QuestionRecordListResponse(
        items=[QuestionRecordItem.model_validate(record) for record in records],
        total=total,
    )


@router.get(
    "/{question_id}",
    response_model=QuestionRecordDetail,
    summary="答题记录详情",
)
async def get_record(
    question_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> QuestionRecordDetail:
    try:
        record = await question_service.get_record(
            session,
            question_id=question_id,
            user_id=current_user.id,
        )
    except question_service.QuestionNotFoundError as exc:
        raise not_found() from exc
    return QuestionRecordDetail.model_validate(record)
