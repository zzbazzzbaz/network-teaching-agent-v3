import logging
from pathlib import Path

from agentscope.app.storage import AgentData, AgentRecord, StorageBase

from app.agent.runtime.models import build_chat_credential, build_embedding_credential
from app.shared.config import Settings
from app.shared.constants import EXAM_AGENT_ID, SYSTEM_USER_ID, TEACH_AGENT_ID

logger = logging.getLogger(__name__)

_PROMPT_DIR = Path(__file__).resolve().parent.parent / "resource" / "prompts"

_AGENT_SEEDS = (
    (TEACH_AGENT_ID, "计算机网络教学智能体", "teaching_agent.md"),
    (EXAM_AGENT_ID, "408 计算机网络备考智能体", "exam_agent.md"),
)


async def ensure_seed(storage: StorageBase, settings: Settings) -> None:
    chat_credential = build_chat_credential(settings)
    embedding_credential = build_embedding_credential(settings)

    await storage.upsert_credential(SYSTEM_USER_ID, embedding_credential)
    await storage.upsert_credential(SYSTEM_USER_ID, chat_credential)

    for agent_id, name, prompt_name in _AGENT_SEEDS:
        agent = AgentRecord(
            id=agent_id,
            user_id=SYSTEM_USER_ID,
            data=AgentData(
                id=agent_id,
                name=name,
                system_prompt=(_PROMPT_DIR / prompt_name).read_text(encoding="utf-8"),
            ),
        )
        await storage.upsert_agent(SYSTEM_USER_ID, agent)

    logger.info(
        "agent seed ready: chat=%s embedding=%s agents=%s",
        chat_credential.id,
        embedding_credential.id,
        ", ".join(agent_id for agent_id, _, _ in _AGENT_SEEDS),
    )
