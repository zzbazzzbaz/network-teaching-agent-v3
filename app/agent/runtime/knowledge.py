from agentscope.app.rag import CollectionPerKbManager, LocalBlobStore
from agentscope.app.storage import StorageBase
from agentscope.rag import PDFParser, PPTParser, QdrantStore, TextParser, WordParser

from app.shared.config import Settings


def build_blob_store(settings: Settings) -> LocalBlobStore:
    return LocalBlobStore(root_dir=str(settings.kb_blobs_dir))


def build_parsers() -> list:
    return [TextParser(), PDFParser(), WordParser(), PPTParser()]


def build_kb_manager(
    settings: Settings,
    storage: StorageBase,
) -> CollectionPerKbManager:
    return CollectionPerKbManager(
        storage=storage,
        vector_store=QdrantStore(url=settings.qdrant_url),
    )


async def verify_qdrant(url: str) -> None:
    """启动探活: QdrantStore 的 client 懒创建, 必须显式打一次。"""
    client = QdrantStore(url=url).get_client()
    try:
        await client.get_collections()
    finally:
        await client.close()
