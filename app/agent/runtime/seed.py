import logging
from pathlib import Path

from agentscope.app.storage import AgentData, AgentRecord, StorageBase

from app.agent.runtime.models import build_chat_credential, build_embedding_credential
from app.shared.config import Settings
from app.shared.constants import SYSTEM_USER_ID, TEACH_AGENT_ID

logger = logging.getLogger(__name__)

_PROMPT_PATH = Path(__file__).resolve().parent.parent / "resource" / "prompts" / "teaching_agent.md"


async def ensure_seed(storage: StorageBase, settings: Settings) -> None:
    chat_credential = build_chat_credential(settings)
    embedding_credential = build_embedding_credential(settings)

    await storage.upsert_credential(SYSTEM_USER_ID, embedding_credential)
    await storage.upsert_credential(SYSTEM_USER_ID, chat_credential)

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
        chat_credential.id,
        embedding_credential.id,
        TEACH_AGENT_ID,
    )
