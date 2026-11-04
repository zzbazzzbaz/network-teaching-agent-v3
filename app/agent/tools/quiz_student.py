import logging
import uuid
from typing import Any

from agentscope.message import ToolResultBlock, ToolResultState
from agentscope.permission import (
    PermissionBehavior,
    PermissionContext,
    PermissionDecision,
)
from agentscope.tool import ToolBase

from app.agent.tools.client import InternalApiClient, InternalApiError
from app.agent.tools.schemas.quiz_student import QuizStudentAnswer, QuizStudentQuestion
from app.api.endpoints.schemas.internal_question import (
    AnswerWriteRequest,
    QuestionPayload,
)

logger = logging.getLogger(__name__)

_DESCRIPTION = (
    "向学生提出一道检查题并等待作答, 用于确认理解、暴露误解、推动学生自己推导。"
    "一次只问一个主问题。学生作答后会在后台记录到题库, 不要在对话里解释保存机制, "
    "拿到参考答案后先判断对错再决定怎么反馈。"
)


class QuizStudent(ToolBase):
    name: str = "quiz_student"
    description: str = _DESCRIPTION

    input_schema: dict[str, Any] = QuizStudentQuestion.model_json_schema()
    metadata_schema: dict[str, Any] | None = QuizStudentAnswer.model_json_schema()

    is_read_only: bool = False
    is_concurrency_safe: bool = False
    is_external_tool: bool = True

    def __init__(
        self,
        client: InternalApiClient,
        user_id: str,
        session_id: str,
    ) -> None:
        super().__init__()
        self._client = client
        self._user_id = user_id
        self._session_id = uuid.UUID(session_id)

    async def check_permissions(
        self,
        tool_input: dict[str, Any],
        context: PermissionContext,
    ) -> PermissionDecision:
        del tool_input, context
        return PermissionDecision(
            behavior=PermissionBehavior.ALLOW,
            message="题目由前端 HITL 作答, 无需确认工具调用。",
        )

    async def check_external_result(self, result: ToolResultBlock) -> None:
        await super().check_external_result(result)
        if result.state != ToolResultState.SUCCESS:
            return

        payload = QuizStudentAnswer.model_validate(result.metadata)
        try:
            await self._client.write_answer(
                self._user_id,
                AnswerWriteRequest(
                    session_id=self._session_id,
                    tool_call_id=result.id,
                    question=QuestionPayload.model_validate(
                        payload.question.model_dump(mode="json"),
                    ),
                    answer=payload.answer,
                ),
            )
        except InternalApiError as exc:
            logger.warning(
                "quiz_student 作答落库失败: tool_call_id=%s error=%s",
                result.id,
                exc,
            )

        result.output = f"学生答案: {payload.answer}"
