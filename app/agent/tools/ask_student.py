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
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.agent.tools.client import InternalApiClient, InternalApiError
from app.api.endpoints.schemas.internal_question import (
    AnswerWriteRequest,
    QuestionPayload,
)
from app.repositories.models import QuestionType

logger = logging.getLogger(__name__)

_DESCRIPTION = (
    "向学生提出一道检查题并等待作答, 用于确认理解、暴露误解、推动学生自己推导。"
    "一次只问一个主问题。学生作答后会在后台记录到题库, 不要在对话里解释保存机制, "
    "拿到参考答案后先判断对错再决定怎么反馈。"
)


class AskStudentQuestion(QuestionPayload):
    """模型出题参数; 同时是前端作答时必须原样回传的题目快照。"""


class AskStudentAnswer(BaseModel):
    """学生的作答。"""

    model_config = ConfigDict(str_strip_whitespace=True)

    answer: str = Field(
        min_length=1,
        max_length=2000,
        description='学生答案。单选题传字母, 例如 "B"; 简答题传文本。',
    )


class AskStudentMetadata(AskStudentAnswer):
    """``ToolResultBlock.metadata`` 的约定: 答案 + 题目快照。"""

    question: AskStudentQuestion = Field(
        description="出题时的题目快照, 原样带回; agent 进程靠它重建题目并落库。",
    )


class AskStudent(ToolBase):
    """出题并等待外部作答的教学工具。"""

    name: str = "ask_student"
    description: str = _DESCRIPTION

    input_schema: dict[str, Any] = AskStudentQuestion.model_json_schema()
    metadata_schema: dict[str, Any] | None = AskStudentMetadata.model_json_schema()

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
        del context
        try:
            AskStudentQuestion.model_validate(tool_input)
        except ValidationError as exc:
            reason = "; ".join(error["msg"] for error in exc.errors())
            return PermissionDecision(
                behavior=PermissionBehavior.DENY,
                message=f"题目不合法, 请修正后重新出题: {reason}",
            )
        return PermissionDecision(
            behavior=PermissionBehavior.ALLOW,
            message="题目由前端 HITL 作答, 无需确认工具调用。",
        )

    async def check_external_result(self, result: ToolResultBlock) -> None:
        await super().check_external_result(result)
        if result.state != ToolResultState.SUCCESS:
            return

        metadata = AskStudentMetadata.model_validate(result.metadata)
        try:
            await self._client.write_answer(
                self._user_id,
                AnswerWriteRequest(
                    session_id=self._session_id,
                    tool_call_id=result.id,
                    question=metadata.question,
                    answer=metadata.answer,
                ),
            )
        except InternalApiError as exc:
            logger.warning(
                "ask_student 作答落库失败: tool_call_id=%s error=%s",
                result.id,
                exc,
            )

        result.output = f"学生答案：{metadata.answer}"
