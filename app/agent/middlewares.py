from collections.abc import AsyncGenerator, Callable

from agentscope.agent import Agent
from agentscope.middleware import MiddlewareBase
from agentscope.workspace import LocalWorkspace, WorkspaceBase

from app.agent.memory import get_memory
from app.agent.workspace import TEACHING_WORKSPACE_INSTRUCTIONS
from app.core.config import get_settings

# 服务层默认下发的工具里有 shell / 文件 / 团队 / 调度 / 规划五类,
# 教学场景一律不需要: 前两类是安全风险, 后三类会带来额外 token 与子 agent 成本。
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


class MemoryOnlyToolsMiddleware(MiddlewareBase):
    """每轮回复前摘掉无关工具, 只留记忆与业务工具。"""

    async def on_reply(
        self,
        agent: Agent,
        input_kwargs: dict,
        next_handler: Callable[..., AsyncGenerator],
    ) -> AsyncGenerator:
        await agent.toolkit.remove_tool(_STRIP_TOOLS)
        async for item in next_handler(**input_kwargs):
            yield item


async def agent_middlewares(
    user_id: str,
    agent_id: str,
    session_id: str,
    workspace: WorkspaceBase,
) -> list[MiddlewareBase]:
    """每轮装配中间件: 覆写工作区提示 + 长期记忆 + 工具裁剪。"""
    del agent_id, session_id
    if isinstance(workspace, LocalWorkspace):
        workspace.instructions = TEACHING_WORKSPACE_INSTRUCTIONS
    return [
        await get_memory(get_settings(), user_id),
        MemoryOnlyToolsMiddleware(),
    ]
