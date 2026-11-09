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

from app.agent.tools.client import InternalApiClient
from app.agent.tools.schemas.quiz_student import QuizStudentAnswer
from app.shared.dto.internal_question import AnswerRelayRequest, QuestionPayload
from app.shared.errors import RemoteServiceError

logger = logging.getLogger(__name__)

_DESCRIPTION = (
    "向学生提出一道检查题, 由前端卡片呈现并等待作答, 是阻塞式的人机协作工具。"
    "学生需要练习, 或你刚讲完一个知识点要验证理解时使用; 一次只出一题, 学生未作答前不要出下一题。"
    "调用后本轮立即结束, 等学生提交答案再继续。"
    "单选题必须给 options 和 correct_option, 简答题必须给 reference_answer。"
    "学生作答会在后台自动记录为答题历史, 不要在对话里解释保存机制; "
    "拿到答案后先按 correct_option 或 reference_answer 判分, 再决定怎么反馈。"
)


class QuizStudent(ToolBase):
    name: str = "quiz_student"
    description: str = _DESCRIPTION

    input_schema: dict[str, Any] = QuestionPayload.model_json_schema()
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
                AnswerRelayRequest(
                    session_id=self._session_id,
                    tool_call_id=result.id,
                    question=payload.question,
                    answer=payload.answer,
                ),
            )
        except RemoteServiceError as exc:
            logger.warning(
                "quiz_student 作答落库失败: tool_call_id=%s error=%s",
                result.id,
                exc,
            )

        result.output = f"学生答案: {payload.answer}"
