from agentscope.credential import DashScopeCredential
from agentscope.embedding import DashScopeEmbeddingModel
from agentscope.model import DashScopeChatModel

from app.core.config import Settings

# text-embedding-v4 的默认输出维度。
EMBEDDING_DIMENSIONS = 1024


def build_chat_model(settings: Settings) -> DashScopeChatModel:
    """对话与记忆抽取复用同一个主模型, 走百炼兼容端点。"""
    return DashScopeChatModel(
        credential=DashScopeCredential(
            api_key=settings.llm.api_key,
            base_url=settings.llm.base_url,
        ),
        model=settings.llm.chat_model,
    )


def build_embedding_model(settings: Settings) -> DashScopeEmbeddingModel:
    """向量化走 DashScope 原生接口, 不经过兼容端点。"""
    return DashScopeEmbeddingModel(
        credential=DashScopeCredential(api_key=settings.llm.api_key),
        model=settings.llm.embedding_model,
        dimensions=EMBEDDING_DIMENSIONS,
    )
