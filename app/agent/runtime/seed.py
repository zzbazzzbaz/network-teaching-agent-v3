import logging
from pathlib import Path

from agentscope.app.rag.knowledge_base_manager import KnowledgeBaseManagerBase
from agentscope.app.storage import AgentData, AgentRecord, StorageBase

from app.agent.runtime.knowledge import (
    build_default_chunker_config,
    build_embedding_model_config,
)
from app.agent.runtime.models import build_chat_credential, build_embedding_credential
from app.shared.config import Settings
from app.shared.constants import (
    DEFAULT_PUBLIC_KB_DESCRIPTION,
    DEFAULT_PUBLIC_KB_NAME,
    SYSTEM_USER_ID,
    TEACH_AGENT_ID,
)

logger = logging.getLogger(__name__)

_PROMPT_PATH = Path(__file__).resolve().parent.parent / "resource" / "prompts" / "teaching_agent.md"


async def _ensure_public_knowledge_base(
    manager: KnowledgeBaseManagerBase,
    settings: Settings,
) -> None:
    records = await manager.list_knowledge_bases(SYSTEM_USER_ID)
    if records:
        return
    try:
        await manager.create_knowledge_base(
            user_id=SYSTEM_USER_ID,
            name=DEFAULT_PUBLIC_KB_NAME,
            description=DEFAULT_PUBLIC_KB_DESCRIPTION,
            embedding_model_config=build_embedding_model_config(settings),
            chunker_config=build_default_chunker_config(),
        )
    except Exception:
        logger.exception("public knowledge base seed failed")
        return
    logger.info("public knowledge base seeded: %s", DEFAULT_PUBLIC_KB_NAME)


async def ensure_seed(
    storage: StorageBase,
    settings: Settings,
    knowledge_base_manager: KnowledgeBaseManagerBase | None,
) -> None:
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

    if knowledge_base_manager is not None:
        await _ensure_public_knowledge_base(knowledge_base_manager, settings)

    logger.info(
        "agent seed ready: chat=%s embedding=%s agent=%s",
        chat_credential.id,
        embedding_credential.id,
        TEACH_AGENT_ID,
    )
