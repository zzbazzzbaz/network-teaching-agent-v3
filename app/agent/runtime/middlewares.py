import logging
import uuid
from collections.abc import AsyncGenerator, Callable
from datetime import UTC, datetime
from typing import ClassVar

from agentscope.agent import Agent
from agentscope.message import Usage
from agentscope.middleware import MiddlewareBase, TracingMiddleware
from agentscope.workspace import LocalWorkspace, WorkspaceBase
from opentelemetry import trace

from app.agent.runtime.memory import get_memory
from app.agent.runtime.workspace import TEACHING_WORKSPACE_INSTRUCTIONS
from app.agent.tools.client import get_client
from app.shared.config import get_settings
from app.shared.dto.internal_usage import ReplyUsageReport

logger = logging.getLogger(__name__)


def _reply_usage(agent: Agent) -> Usage | None:
    reply_id = agent.state.reply_id
    for message in reversed(agent.state.context):
        if message.id == reply_id and message.role == "assistant":
            return message.usage
    return None


class UsageReportMiddleware(MiddlewareBase):
    """每轮回复结束后记录token用量"""

    def __init__(self, user_id: str, session_id: str) -> None:
        self._user_id = user_id
        self._session_id = session_id
        self._started_at = datetime.now(UTC)

    async def on_reply(
        self,
        agent: Agent,
        input_kwargs: dict,
        next_handler: Callable[..., AsyncGenerator],
    ) -> AsyncGenerator:
        try:
            async for item in next_handler(**input_kwargs):
                yield item
        finally:
            await self._report(agent)

    async def _report(self, agent: Agent) -> None:
        usage = _reply_usage(agent)
        if usage is None:
            return
        try:
            await get_client().report_reply_usage(
                self._user_id,
                ReplyUsageReport(
                    session_id=uuid.UUID(self._session_id),
                    reply_id=agent.state.reply_id,
                    input_tokens=usage.input_tokens,
                    output_tokens=usage.output_tokens,
                    cache_input_tokens=usage.cache_input_tokens,
                    cache_creation_input_tokens=usage.cache_creation_input_tokens,
                    started_at=self._started_at,
                ),
            )
        except Exception:
            logger.exception(
                "usage report failed: user_id=%s session_id=%s reply_id=%s",
                self._user_id,
                self._session_id,
                agent.state.reply_id,
            )


class MemoryOnlyToolsMiddleware(MiddlewareBase):
    """每轮回复前摘掉无关工具"""

    _STRIP_TOOLS: ClassVar[list[str]] = [
        "Bash",
        "PowerShell",
        "Edit",
        "Glob",
        "Grep",
        "Read",
        "Write",
        "TeamCreate",
        "AgentCreate",
        "AgentInvite",
        "TeamDelete",
        "TeamSay",
        "ScheduleCreate",
        "ScheduleView",
        "ScheduleList",
        "ScheduleDelete",
        "TaskCreate",
        "TaskGet",
        "TaskList",
        "TaskUpdate",
    ]

    async def on_reply(
        self,
        agent: Agent,
        input_kwargs: dict,
        next_handler: Callable[..., AsyncGenerator],
    ) -> AsyncGenerator:
        await agent.toolkit.remove_tool(self._STRIP_TOOLS)
        async for item in next_handler(**input_kwargs):
            yield item


class TracingUserMiddleware(MiddlewareBase):
    """把学生 ID 写入 trace 便于按用户筛选"""

    def __init__(self, user_id: str) -> None:
        self._user_id = user_id

    async def on_reply(
        self,
        agent: Agent,
        input_kwargs: dict,
        next_handler: Callable[..., AsyncGenerator],
    ) -> AsyncGenerator:
        span = trace.get_current_span()
        if span.is_recording():
            span.set_attribute("user.id", self._user_id)
        async for item in next_handler(**input_kwargs):
            yield item


async def agent_middlewares(
    user_id: str,
    agent_id: str,
    session_id: str,
    workspace: WorkspaceBase,
) -> list[MiddlewareBase]:
    del agent_id
    if isinstance(workspace, LocalWorkspace):
        workspace.instructions = TEACHING_WORKSPACE_INSTRUCTIONS
    return [
        UsageReportMiddleware(user_id, session_id),
        await get_memory(get_settings(), user_id),
        MemoryOnlyToolsMiddleware(),
        TracingMiddleware(),
        TracingUserMiddleware(user_id),
    ]
