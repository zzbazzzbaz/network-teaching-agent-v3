import uuid
from typing import Any, cast

import pytest
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.services import session_service
from app.shared.dto.session import CreateSessionRequest
from app.shared.enums import AgentKind


class FakeAgentClient:
    def __init__(self, session_id: str) -> None:
        self.session_id = session_id
        self.create_kwargs: dict[str, Any] = {}

    async def create_session(self, **kwargs: Any) -> str:
        self.create_kwargs = kwargs
        return self.session_id

    async def delete_session(self, **_kwargs: Any) -> bool:
        return True


class FakeSession:
    def __init__(self) -> None:
        self.added: list[Any] = []

    def add(self, item: Any) -> None:
        self.added.append(item)

    async def flush(self) -> None:
        return None

    async def commit(self) -> None:
        return None

    async def rollback(self) -> None:
        return None


def test_create_session_request_defaults_to_teach() -> None:
    assert CreateSessionRequest().agent_kind is AgentKind.TEACH


def test_create_session_request_allows_exam() -> None:
    assert CreateSessionRequest(agent_kind=AgentKind.EXAM).agent_kind is AgentKind.EXAM


def test_create_session_request_rejects_exp() -> None:
    with pytest.raises(ValidationError):
        CreateSessionRequest(agent_kind=AgentKind.EXP)


@pytest.mark.asyncio
async def test_create_exam_session_routes_to_exam_agent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = FakeAgentClient(str(uuid.uuid4()))
    monkeypatch.setattr(session_service, "get_agent_client", lambda: client)
    session = FakeSession()

    chat = await session_service.create_session(
        cast(AsyncSession, session),
        user_id=uuid.uuid4(),
        knowledge_base_ids=[],
        agent_kind=AgentKind.EXAM,
    )

    assert client.create_kwargs["agent_id"] == "exam_agent"
    assert chat.agent_kind is AgentKind.EXAM
