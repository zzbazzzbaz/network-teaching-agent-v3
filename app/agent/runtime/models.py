from agentscope.credential import DashScopeCredential, DeepSeekCredential
from agentscope.embedding import DashScopeEmbeddingModel
from agentscope.model import DeepSeekChatModel

from app.shared.config import Settings
from app.shared.constants import CHAT_CREDENTIAL_ID, EMBEDDING_CREDENTIAL_ID

EMBEDDING_DIMENSIONS = 1024


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


def build_chat_model(settings: Settings) -> DeepSeekChatModel:
    return DeepSeekChatModel(
        credential=build_chat_credential(settings),
        model=settings.chat.model,
    )


def build_embedding_model(settings: Settings) -> DashScopeEmbeddingModel:
    return DashScopeEmbeddingModel(
        credential=build_embedding_credential(settings),
        model=settings.embedding.model,
        dimensions=EMBEDDING_DIMENSIONS,
    )
