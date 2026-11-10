from collections.abc import AsyncIterator

import pytest

from app.api.infra.cos import ObjectMeta
from app.api.services import knowledge_service
from app.shared.config import get_settings


def _document(
    document_id: str = "doc-1",
    *,
    filename: str = "notes.md",
    content_type: str = "text/markdown",
) -> dict:
    return {
        "id": document_id,
        "filename": filename,
        "size": 5,
        "content_type": content_type,
        "status": "ready",
        "error": None,
        "chunk_count": 1,
        "created_at": "2026-11-08T10:00:00Z",
        "updated_at": "2026-11-08T10:05:00Z",
    }


class FakeAgentClient:
    def __init__(self) -> None:
        self.uploaded: dict | None = None
        self.deleted: list[str] = []

    async def list_knowledge_documents(self, **kwargs) -> dict:
        del kwargs
        return {"documents": [], "total": 0}

    async def list_knowledge_document_status(self, **kwargs) -> dict:
        del kwargs
        return {"items": [_document()]}

    async def upload_knowledge_document(self, **kwargs) -> dict:
        self.uploaded = kwargs
        return {
            "document_id": "doc-1",
            "filename": kwargs["filename"],
            "status": "pending",
        }

    async def delete_knowledge_document(self, **kwargs) -> None:
        self.deleted.append(kwargs["document_id"])


def test_normalize_upload_id() -> None:
    value = "0123456789abcdef0123456789abcdef"
    assert knowledge_service._normalize_upload_id(value) == value
    with pytest.raises(knowledge_service.KnowledgeInvalidError):
        knowledge_service._normalize_upload_id("../../etc/passwd")


@pytest.mark.asyncio
async def test_create_upload_url_uses_private_temp_prefix(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = FakeAgentClient()
    captured: dict[str, str] = {}

    def fake_upload_url(key: str, headers: dict[str, str]) -> str:
        captured["key"] = key
        captured["content_type"] = headers["Content-Type"]
        return "https://cos.example.com/put"

    monkeypatch.setattr(knowledge_service, "get_agent_client", lambda: client)
    monkeypatch.setattr(knowledge_service.cos, "upload_url", fake_upload_url)

    ticket = await knowledge_service.create_upload_url(
        "user-1",
        "kb-1",
        uploader_user_id="user-1",
        filename="notes.md",
        size_bytes=5,
    )

    assert captured["key"] == f"tmp/knowledge/user-1/{ticket.upload_id}"
    assert captured["content_type"] == "text/markdown"
    assert ticket.headers == {"Content-Type": "text/markdown"}
    assert ticket.expires_in == get_settings().cos.upload_expires


@pytest.mark.asyncio
async def test_complete_upload_streams_temp_object_to_agent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = FakeAgentClient()
    deleted: list[str] = []
    payload = b"hello"

    async def fake_iter_object(key: str) -> AsyncIterator[bytes]:
        assert key == "tmp/knowledge/user-1/0123456789abcdef0123456789abcdef"
        yield payload

    async def fake_object_meta(key: str) -> ObjectMeta | None:
        assert key == "tmp/knowledge/user-1/0123456789abcdef0123456789abcdef"
        return ObjectMeta(size=len(payload), content_type="text/markdown")

    async def fake_delete(key: str) -> None:
        deleted.append(key)

    monkeypatch.setattr(knowledge_service, "get_agent_client", lambda: client)
    monkeypatch.setattr(knowledge_service.cos, "object_meta", fake_object_meta)
    monkeypatch.setattr(knowledge_service.cos, "iter_object", fake_iter_object)
    monkeypatch.setattr(knowledge_service.cos, "delete_object", fake_delete)

    result = await knowledge_service.complete_upload(
        "user-1",
        "kb-1",
        uploader_user_id="user-1",
        upload_id="0123456789abcdef0123456789abcdef",
        filename="notes.md",
        size_bytes=len(payload),
        content_type="text/markdown",
    )

    assert result.id == "doc-1"
    assert result.filename == "notes.md"
    assert client.uploaded is not None
    assert client.uploaded["size"] == len(payload)
    assert client.uploaded["content_type"] == "text/markdown"
    chunks = [chunk async for chunk in client.uploaded["chunks"]]
    assert b"".join(chunks) == payload
    assert deleted == ["tmp/knowledge/user-1/0123456789abcdef0123456789abcdef"]


@pytest.mark.asyncio
async def test_complete_upload_rejects_size_mismatch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = FakeAgentClient()
    deleted: list[str] = []

    async def fake_object_meta(key: str) -> ObjectMeta | None:
        del key
        return ObjectMeta(size=4, content_type="text/markdown")

    async def fake_delete(key: str) -> None:
        deleted.append(key)

    monkeypatch.setattr(knowledge_service, "get_agent_client", lambda: client)
    monkeypatch.setattr(knowledge_service.cos, "object_meta", fake_object_meta)
    monkeypatch.setattr(knowledge_service.cos, "delete_object", fake_delete)

    with pytest.raises(knowledge_service.KnowledgeInvalidError):
        await knowledge_service.complete_upload(
            "user-1",
            "kb-1",
            uploader_user_id="user-1",
            upload_id="0123456789abcdef0123456789abcdef",
            filename="notes.md",
            size_bytes=5,
            content_type="text/markdown",
        )

    assert client.uploaded is None
    assert deleted == ["tmp/knowledge/user-1/0123456789abcdef0123456789abcdef"]


@pytest.mark.asyncio
async def test_document_download_url_uses_private_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = FakeAgentClient()
    captured: dict[str, str] = {}

    async def fake_object_meta(key: str) -> ObjectMeta | None:
        captured["key"] = key
        return ObjectMeta(size=5, content_type="application/octet-stream")

    def fake_download_url(
        key: str,
        filename: str,
        content_type: str,
        *,
        inline: bool,
    ) -> str:
        captured["download"] = f"{key}|{filename}|{content_type}|{inline}"
        return "https://cos.example.com/signed"

    monkeypatch.setattr(knowledge_service, "get_agent_client", lambda: client)
    monkeypatch.setattr(knowledge_service.cos, "object_meta", fake_object_meta)
    monkeypatch.setattr(knowledge_service.cos, "download_url", fake_download_url)

    result = await knowledge_service.document_download_url("user-1", "kb-1", "doc-1")

    assert captured["key"] == "private/knowledge/kb-1/doc-1"
    assert captured["download"] == "private/knowledge/kb-1/doc-1|notes.md|text/markdown|False"
    assert result.url == "https://cos.example.com/signed"
    assert result.filename == "notes.md"
    assert result.expires_in == get_settings().cos.download_expires
