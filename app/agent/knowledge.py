from agentscope.app.access import (
    ResourceAccessPolicyBase,
    ResourceKind,
    ResourcePermission,
    ResourceRef,
)
from agentscope.app.rag import CollectionPerKbManager, LocalBlobStore
from agentscope.app.storage import StorageBase
from agentscope.rag import PDFParser, PPTParser, QdrantStore, TextParser, WordParser

from app.core.config import Settings

# 公共库归属与 id 列表硬编码: 换库需要发版, 不走配置。
PUBLIC_OWNER = "system"
PUBLIC_KB_IDS: tuple[str, ...] = ()


class TeachingAccessPolicy(ResourceAccessPolicyBase):
    """公共库对所有用户只读; 个人库由 storage 的 owner 隔离, 不在此出现。"""

    async def list_accessible(
        self,
        viewer_id: str,
        kind: ResourceKind,
        storage: StorageBase,
    ) -> list[ResourceRef]:
        del viewer_id, storage
        if kind is not ResourceKind.KNOWLEDGE_BASE:
            return []
        return [
            ResourceRef(
                kind=ResourceKind.KNOWLEDGE_BASE,
                owner_id=PUBLIC_OWNER,
                resource_id=kb_id,
                permission=ResourcePermission.READ,
            )
            for kb_id in PUBLIC_KB_IDS
        ]


def build_vector_store(settings: Settings) -> QdrantStore:
    """无 path 回退: 地址来自必填的 QDRANT_URL。"""
    return QdrantStore(url=settings.qdrant_url)


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
        vector_store=build_vector_store(settings),
    )


def build_access_policy(settings: Settings) -> TeachingAccessPolicy:
    del settings
    return TeachingAccessPolicy()


async def verify_qdrant(url: str) -> None:
    """启动探活: QdrantStore 的 client 懒创建, 必须显式打一次。"""
    client = QdrantStore(url=url).get_client()
    try:
        await client.get_collections()
    finally:
        await client.close()
