from collections.abc import AsyncGenerator, Callable

from agentscope.agent import Agent
from agentscope.middleware import MiddlewareBase
from agentscope.workspace import LocalWorkspace, WorkspaceBase

from app.agent.runtime.memory import get_memory
from app.agent.runtime.workspace import TEACHING_WORKSPACE_INSTRUCTIONS
from app.core.config import get_settings


class MemoryOnlyToolsMiddleware(MiddlewareBase):
    """每轮回复前摘掉无关工具"""
    _STRIP_TOOLS = [
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


async def agent_middlewares(
        user_id: str,
        agent_id: str,
        session_id: str,
        workspace: WorkspaceBase,
) -> list[MiddlewareBase]:
    del agent_id, session_id
    if isinstance(workspace, LocalWorkspace):
        workspace.instructions = TEACHING_WORKSPACE_INSTRUCTIONS
    return [
        await get_memory(get_settings(), user_id),
        MemoryOnlyToolsMiddleware(),
    ]
