from agentscope.credential import DashScopeCredential, DeepSeekCredential
from agentscope.embedding import DashScopeEmbeddingModel
from agentscope.model import DeepSeekChatModel

from app.shared.config import Settings

EMBEDDING_DIMENSIONS = 1024


def build_chat_model(settings: Settings) -> DeepSeekChatModel:
    return DeepSeekChatModel(
        credential=DeepSeekCredential(
            api_key=settings.chat.api_key,
            base_url=settings.chat.base_url,
        ),
        model=settings.chat.model,
    )


def build_embedding_model(settings: Settings) -> DashScopeEmbeddingModel:
    return DashScopeEmbeddingModel(
        credential=DashScopeCredential(
            api_key=settings.embedding.api_key,
            base_url=settings.embedding.base_url,
        ),
        model=settings.embedding.model,
        dimensions=EMBEDDING_DIMENSIONS,
    )
