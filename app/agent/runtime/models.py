from agentscope.credential import DashScopeCredential, DeepSeekCredential
from agentscope.embedding import DashScopeEmbeddingModel, EmbeddingModelBase
from agentscope.model import DeepSeekChatModel

from app.agent.runtime.observability import (
    MeteredChatModel,
    MeteredEmbeddingModel,
    UsageCategory,
)
from app.shared.config import Settings
from app.shared.constants import (
    CHAT_CREDENTIAL_ID,
    EMBEDDING_CREDENTIAL_ID,
    EMBEDDING_DIMENSIONS,
)


def build_chat_credential(settings: Settings) -> DeepSeekCredential:
    return DeepSeekCredential(
        id=CHAT_CREDENTIAL_ID,
        name="DeepSeek",
        api_key=settings.chat.api_key,
        base_url=settings.chat.base_url,
    )


def build_embedding_credential(settings: Settings) -> DashScopeCredential:
    return DashScopeCredential(
        id=EMBEDDING_CREDENTIAL_ID,
        name="百炼",
        api_key=settings.embedding.api_key,
        base_url=settings.embedding.base_url,
    )


def build_chat_model(
    settings: Settings,
    *,
    user_id: str | None = None,
) -> DeepSeekChatModel:
    return MeteredChatModel(
        credential=build_chat_credential(settings),
        model=settings.chat.model,
        category=UsageCategory.REME_CHAT,
        user_id=user_id,
    )


def build_embedding_model(
    settings: Settings,
    *,
    user_id: str | None = None,
) -> MeteredEmbeddingModel:
    model = DashScopeEmbeddingModel(
        credential=build_embedding_credential(settings),
        model=settings.embedding.model,
        dimensions=EMBEDDING_DIMENSIONS,
    )
    return MeteredEmbeddingModel(
        model,
        category=UsageCategory.REME_EMBEDDING,
        user_id=user_id,
    )


def build_knowledge_embedding_model(
    model: EmbeddingModelBase,
    *,
    user_id: str | None = None,
) -> MeteredEmbeddingModel:
    return MeteredEmbeddingModel(
        model,
        category=UsageCategory.KNOWLEDGE_EMBEDDING,
        user_id=user_id,
    )
