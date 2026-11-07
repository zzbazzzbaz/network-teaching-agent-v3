import logging
from pathlib import Path

from agentscope.app.storage import AgentData, AgentRecord, StorageBase
from agentscope.credential import DashScopeCredential, DeepSeekCredential

from app.shared.config import Settings
from app.shared.constants import (
    CHAT_CREDENTIAL_ID,
    EMBEDDING_CREDENTIAL_ID,
    SYSTEM_USER_ID,
    TEACH_AGENT_ID,
)

logger = logging.getLogger(__name__)

_PROMPT_PATH = Path(__file__).resolve().parent.parent / "resource" / "prompts" / "teaching_agent.md"


async def ensure_seed(storage: StorageBase, settings: Settings) -> None:
    bailian_credential = DashScopeCredential(
        id=EMBEDDING_CREDENTIAL_ID,
        name="百炼",
        api_key=settings.embedding.api_key,
        base_url=settings.embedding.base_url,
    )
    await storage.upsert_credential(SYSTEM_USER_ID, bailian_credential)

    deepseek_credential = DeepSeekCredential(
        id=CHAT_CREDENTIAL_ID,
        name="DeepSeek 官方",
        api_key=settings.chat.api_key,
        base_url=settings.chat.base_url,
    )
    await storage.upsert_credential(SYSTEM_USER_ID, deepseek_credential)

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
    logger.info(
        "agent seed ready: chat=%s embedding=%s agent=%s",
        CHAT_CREDENTIAL_ID,
        EMBEDDING_CREDENTIAL_ID,
        TEACH_AGENT_ID,
    )
