import logging
from typing import Any

from agentscope.message import TextBlock, ToolResultState
from agentscope.permission import (
    PermissionBehavior,
    PermissionContext,
    PermissionDecision,
)
from agentscope.tool import ToolBase, ToolChunk

from app.agent.tools.client import InternalApiClient
from app.agent.tools.schemas.get_question import GetQuestionInput
from app.shared.dto.internal_question import QuestionDetailResponse
from app.shared.errors import RemoteServiceError
from app.shared.time import APP_TZ

logger = logging.getLogger(__name__)

_DESCRIPTION = (
    "根据学生提供的题目 ID 获取题目详情和这名学生最近的作答记录。"
    "只在学生给出题目 ID、或要复习/讲解某道题时使用, 不要自行编造题目 ID。"
    "参考答案只用于判分和讲解, 不要直接展示给学生。"
)


class GetQuestion(ToolBase):
    name: str = "get_question"
    description: str = _DESCRIPTION

    input_schema: dict[str, Any] = GetQuestionInput.model_json_schema()

    is_read_only: bool = True
    is_concurrency_safe: bool = True

    def __init__(self, client: InternalApiClient, user_id: str) -> None:
        super().__init__()
        self._client = client
        self._user_id = user_id

    async def check_permissions(
        self,
        tool_input: dict[str, Any],
        context: PermissionContext,
    ) -> PermissionDecision:
        del tool_input, context
        return PermissionDecision(
            behavior=PermissionBehavior.ALLOW,
            message="题目详情只读, 自动放行。",
        )

    async def call(self, **kwargs: Any) -> ToolChunk:
        data = GetQuestionInput.model_validate(kwargs)
        try:
            detail = await self._client.get_question(
                self._user_id,
                data.question_id,
                data.attempt_limit,
            )
        except RemoteServiceError as exc:
            logger.warning(
                "get_question 获取失败: question_id=%s error=%s",
                data.question_id,
                exc,
            )
            return ToolChunk(
                content=[TextBlock(text=f"题目获取失败: {exc}")],
                state=ToolResultState.ERROR,
            )
        return ToolChunk(content=[TextBlock(text=_format_detail(detail))])


def _format_detail(detail: QuestionDetailResponse) -> str:
    is_single_choice = detail.question_type.value == "single_choice"
    lines = [
        f"题目 ID: {detail.id}",
        f"题型: {'单选' if is_single_choice else '简答'}",
        f"题干: {detail.stem}",
    ]
    if detail.options:
        option_text = "  ".join(f"{letter}. {text}" for letter, text in detail.options.items())
        lines.append(f"选项: {option_text}")
    lines.append(f"参考答案: {detail.answer_text} (仅用于判分和讲解, 不要直接展示给学生)")
    if detail.note:
        lines.append(f"备注: {detail.note}")
    if not detail.attempts:
        lines.append("作答记录: 无")
        return "\n".join(lines)

    lines.append(f"作答记录: 共 {detail.attempt_total} 次, 最近 {len(detail.attempts)} 次")
    for index, attempt in enumerate(detail.attempts, start=1):
        mark = ""
        if is_single_choice:
            correct = attempt.answer_text.strip().upper() == detail.answer_text.strip().upper()
            mark = "  答对" if correct else "  答错"
        stamp = attempt.created_at.astimezone(APP_TZ).strftime("%Y-%m-%d %H:%M")
        lines.append(f"{index}. {stamp}  学生答案: {attempt.answer_text}{mark}")
    return "\n".join(lines)
