from agentscope.app._service._embedding import build_embedding_model
from agentscope.app.rag.knowledge_base_manager import (
    CollectionPerKbManager,
    KnowledgeBaseNotFoundError,
)
from agentscope.app.storage import StorageBase
from agentscope.rag import (
    KnowledgeBase,
    ParserBase,
    PDFParser,
    PPTParser,
    QdrantStore,
    TextParser,
    WordParser,
)

from app.agent.runtime.cos_blob_store import COSBlobStore
from app.agent.runtime.models import build_knowledge_embedding_model
from app.shared.config import Settings
from app.shared.constants import EMBEDDING_CREDENTIAL_ID, SYSTEM_USER_ID


class _SharedCredentialCollectionPerKbManager(CollectionPerKbManager):
    """所有知识库统一使用 system 名下的 embedding credential。"""

    async def get_knowledge(
        self,
        user_id: str,
        knowledge_base_id: str,
    ) -> KnowledgeBase:
        record = await self._storage.get_knowledge_base(user_id, knowledge_base_id)
        if record is None:
            raise KnowledgeBaseNotFoundError(
                f"Knowledge base {knowledge_base_id!r} not found.",
            )

        config = record.data.embedding_model_config
        credential = await self._storage.get_credential(
            SYSTEM_USER_ID,
            EMBEDDING_CREDENTIAL_ID,
        )
        if credential is None:
            raise KnowledgeBaseNotFoundError(
                f"Credential {EMBEDDING_CREDENTIAL_ID!r} for "
                f"knowledge base {knowledge_base_id!r} not found.",
            )

        return KnowledgeBase(
            name=record.data.name,
            description=record.data.description,
            embedding_model=build_knowledge_embedding_model(
                build_embedding_model(
                    credential_record=credential,
                    config=config,
                ),
                user_id=user_id,
            ),
            vector_store=self._vector_store,
            collection=record.data.collection_name,
            metadata_filter=None,
        )


def build_knowledge_base_manager(
    storage: StorageBase,
    settings: Settings,
) -> _SharedCredentialCollectionPerKbManager:
    api_key = settings.qdrant.api_key
    value = api_key.get_secret_value() if api_key is not None else ""
    return _SharedCredentialCollectionPerKbManager(
        storage=storage,
        vector_store=QdrantStore(
            url=settings.qdrant.url,
            api_key=value or None,
        ),
    )


def build_knowledge_blob_store(settings: Settings) -> COSBlobStore:
    return COSBlobStore(
        bucket=settings.cos.bucket,
        region=settings.cos.region,
        secret_id=settings.cos.secret_id,
        secret_key=settings.cos.secret_key,
    )


def build_knowledge_parsers() -> list[ParserBase]:
    return [TextParser(), PDFParser(), WordParser(), PPTParser()]
