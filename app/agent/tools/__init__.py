from agentscope.tool import ToolBase

from app.agent.tools.ask_student import AskStudent


async def agent_tools(
    user_id: str,
    agent_id: str,
    session_id: str,
) -> list[ToolBase]:
    del agent_id
    return [
        AskStudent(user_id=user_id, session_id=session_id),
    ]
