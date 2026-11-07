import logging
from pathlib import Path

from agentscope.app.storage import AgentData, AgentRecord, StorageBase
from agentscope.credential import DashScopeCredential

from app.shared.config import Settings
from app.shared.constants import (
    AGENT_CREDENTIAL_ID,
    SYSTEM_USER_ID,
    TEACH_AGENT_ID,
)

logger = logging.getLogger(__name__)

_PROMPT_PATH = Path(__file__).resolve().parent.parent / "resource" / "prompts" / "teaching_agent.md"


async def ensure_seed(storage: StorageBase, settings: Settings) -> None:
    credential = DashScopeCredential(
        id=AGENT_CREDENTIAL_ID,
        name="百炼",
        api_key=settings.llm.api_key,
        base_url=settings.llm.base_url,
    )
    await storage.upsert_credential(SYSTEM_USER_ID, credential)

    agent = AgentRecord(
        id=TEACH_AGENT_ID,
        user_id=SYSTEM_USER_ID,
        data=AgentData(
            id=TEACH_AGENT_ID,
            name="计算机网络教学智能体",
            system_prompt=_PROMPT_PATH.read_text(encoding="utf-8"),
        ),
    )
    await storage.upsert_agent(SYSTEM_USER_ID, agent)
    logger.info("agent seed ready: credential=%s agent=%s", AGENT_CREDENTIAL_ID, TEACH_AGENT_ID)
