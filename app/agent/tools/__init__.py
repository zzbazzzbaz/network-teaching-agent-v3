from agentscope.tool import ToolBase

from app.agent.tools.client import get_client
from app.agent.tools.materials import MaterialsGrep, MaterialsLs, MaterialsRead
from app.agent.tools.quiz_student import QuizStudent


async def agent_tools(
    user_id: str,
    agent_id: str,
    session_id: str,
) -> list[ToolBase]:
    del agent_id
    client = get_client()
    return [
        QuizStudent(
            client=client,
            user_id=user_id,
            session_id=session_id,
        ),
        MaterialsLs(client=client, user_id=user_id),
        MaterialsRead(client=client, user_id=user_id),
        MaterialsGrep(client=client, user_id=user_id),
    ]
