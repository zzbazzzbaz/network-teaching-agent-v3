"""Agent 进程专用接口: 学生作答回写题库。

路由前缀挂在 ``/api/internal`` 下, 不在 OpenAPI 文档中暴露, 也不走 JWT,
调用者身份由 ``X-User-ID`` 头给出。它只应被 agent 进程访问。
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Query

from app.api.dependencies import InternalUser, SessionDep
from app.repositories.models import QuestionType
from app.services import question_service
from app.shared.dto.internal_question import (
    AnswerWriteRequest,
    AttemptItem,
    QuestionDetailResponse,
)
from app.shared.errors import not_found

router = APIRouter(
    prefix="/internal/questions",
    tags=["内部接口"],
    include_in_schema=False,
)

_LETTERS = "ABCDEF"


@router.post(
    "/answers",
    response_model=bool,
    summary="回写学生作答",
)
async def write_answer(
    body: AnswerWriteRequest,
    user: InternalUser,
    session: SessionDep,
) -> bool:
    question = body.question
    answer = body.answer.strip()
    if question.question_type is QuestionType.SINGLE_CHOICE:
        answer = answer.upper()

    options = dict(zip(_LETTERS, question.options, strict=False)) if question.options else None
    answer_text = (
        question.correct_option
        if question.question_type is QuestionType.SINGLE_CHOICE
        else question.reference_answer
    ) or ""

    try:
        await question_service.record_answer(
            session,
            user_id=user.id,
            session_id=body.session_id,
            tool_call_id=body.tool_call_id,
            stem=question.stem,
            question_type=question.question_type,
            options=options,
            answer_text=answer_text,
            answer=answer,
        )
    except question_service.SessionNotFoundError as exc:
        raise not_found() from exc
    return True


@router.get(
    "/{question_id}",
    response_model=QuestionDetailResponse,
    summary="题目详情与作答记录",
)
async def get_question(
    question_id: uuid.UUID,
    user: InternalUser,
    session: SessionDep,
    attempt_limit: Annotated[int, Query(ge=1, le=20)] = 5,
) -> QuestionDetailResponse:
    try:
        question, attempts, total = await question_service.get_question_with_attempts(
            session,
            question_id=question_id,
            user_id=user.id,
            limit=attempt_limit,
        )
    except question_service.QuestionNotFoundError as exc:
        raise not_found() from exc

    return QuestionDetailResponse(
        id=question.id,
        question_type=question.question_type,
        stem=question.stem,
        options=question.options,
        answer_text=question.answer_text,
        note=question.note,
        created_at=question.created_at,
        attempts=[
            AttemptItem(answer_text=attempt.answer_text, created_at=attempt.created_at)
            for attempt in attempts
        ],
        attempt_total=total,
    )
