from agentscope.tool import ToolBase

from app.agent.tools.client import get_client
from app.agent.tools.get_question import GetQuestion
from app.agent.tools.materials import (
    MaterialsGrep,
    MaterialsLs,
    MaterialsRead,
    materials_root,
)
from app.agent.tools.quiz_student import QuizStudent


async def agent_tools(
    user_id: str,
    agent_id: str,
    session_id: str,
) -> list[ToolBase]:
    del agent_id
    root = materials_root()
    return [
        QuizStudent(
            client=get_client(),
            user_id=user_id,
            session_id=session_id,
        ),
        GetQuestion(
            client=get_client(),
            user_id=user_id,
        ),
        MaterialsLs(root=root),
        MaterialsRead(root=root),
        MaterialsGrep(root=root),
    ]
