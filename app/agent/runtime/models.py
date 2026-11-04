from agentscope.credential import DashScopeCredential
from agentscope.embedding import DashScopeEmbeddingModel
from agentscope.model import DashScopeChatModel

from app.core.config import Settings

EMBEDDING_DIMENSIONS = 1024


def build_chat_model(settings: Settings) -> DashScopeChatModel:
    return DashScopeChatModel(
        credential=DashScopeCredential(
            api_key=settings.llm.api_key,
            base_url=settings.llm.base_url,
        ),
        model=settings.llm.chat_model,
    )


def build_embedding_model(settings: Settings) -> DashScopeEmbeddingModel:
    return DashScopeEmbeddingModel(
        credential=DashScopeCredential(api_key=settings.llm.api_key),
        model=settings.llm.embedding_model,
        dimensions=EMBEDDING_DIMENSIONS,
    )
