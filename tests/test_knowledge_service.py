import pytest

from app.api.services import knowledge_service, session_service
from app.shared.constants import MAX_SESSION_KNOWLEDGE_BASES, SYSTEM_USER_ID


def _base_view(
    knowledge_base_id: str,
    *,
    name: str,
    editable: bool,
    owner_id: str = "user-1",
) -> dict:
    return {
        "id": knowledge_base_id,
        "name": name,
        "description": "",
        "editable": editable,
        "owner_id": owner_id,
        "document_count": 1,
        "chunk_count": 3,
        "status_counts": {"ready": 1},
        "created_at": "2026-11-08T10:00:00",
        "updated_at": "2026-11-08T10:05:00",
    }


class FakeAgentClient:
    def __init__(self, views: list[dict]) -> None:
        self.views = views

    async def list_knowledge_bases(self, **kwargs) -> dict:
        knowledge_base_id = kwargs.get("knowledge_base_id")
        views = self.views
        if knowledge_base_id is not None:
            views = [view for view in views if view["id"] == knowledge_base_id]
        return {
            "knowledge_bases": views,
            "total": len(views),
            "page": 1,
            "page_size": 128,
        }


def test_validate_upload_rules() -> None:
    knowledge_service.validate_upload(filename="notes.md", size=1024)
    with pytest.raises(knowledge_service.KnowledgeInvalidError):
        knowledge_service.validate_upload(filename="notes.exe", size=1024)
    with pytest.raises(knowledge_service.KnowledgeInvalidError):
        knowledge_service.validate_upload(filename="notes.md", size=0)


@pytest.mark.asyncio
async def test_list_bases_maps_visibility(monkeypatch: pytest.MonkeyPatch) -> None:
    client = FakeAgentClient(
        [
            _base_view("kb-private", name="私人", editable=True),
            _base_view("kb-public", name="公共", editable=False, owner_id=SYSTEM_USER_ID),
        ],
    )
    monkeypatch.setattr(knowledge_service, "get_agent_client", lambda: client)

    response = await knowledge_service.list_bases("user-1", mode="mine")
    assert [(item.id, item.visibility, item.editable) for item in response.items] == [
        ("kb-private", "private", True),
        ("kb-public", "public", False),
    ]

    readonly = await knowledge_service.list_bases("user-1", mode="readonly")
    assert [(item.id, item.visibility, item.editable) for item in readonly.items] == [
        ("kb-private", "private", False),
    ]


@pytest.mark.asyncio
async def test_list_visible_base_ids_prefers_private(monkeypatch: pytest.MonkeyPatch) -> None:
    client = FakeAgentClient(
        [
            _base_view("kb-public", name="公共", editable=False, owner_id=SYSTEM_USER_ID),
            _base_view("kb-private", name="私人", editable=True),
        ],
    )
    monkeypatch.setattr(knowledge_service, "get_agent_client", lambda: client)

    ids = await knowledge_service.list_visible_base_ids("user-1")
    assert ids == ["kb-private", "kb-public"]


def test_bind_knowledge_deduplicates_and_limits() -> None:
    assert session_service._bind_knowledge(["a", "a", "b"]) == ["a", "b"]
    assert session_service._bind_knowledge(None) == []
    with pytest.raises(session_service.InvalidKnowledgeSelectionError):
        session_service._bind_knowledge(
            [str(index) for index in range(MAX_SESSION_KNOWLEDGE_BASES + 1)],
        )
