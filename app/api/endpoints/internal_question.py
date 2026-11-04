"""Agent 进程专用接口: 学生作答回写题库。

路由前缀挂在 ``/api/internal`` 下, 不在 OpenAPI 文档中暴露, 也不走 JWT,
调用者身份由 ``X-User-ID`` 头给出。它只应被 agent 进程访问。
"""

from fastapi import APIRouter

from app.api.dependencies import InternalUser, SessionDep
from app.api.endpoints.schemas.internal_question import AnswerWriteRequest
from app.api.errors import not_found
from app.repositories.models import QuestionType
from app.services import question_service

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
