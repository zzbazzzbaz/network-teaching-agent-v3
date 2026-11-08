from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

import httpx

from app.shared.config import get_settings
from app.shared.dto.memory import MemoryEntryDetailDTO, MemoryEntryListDTO
from app.shared.errors import RemoteServiceError
from app.shared.http import InternalHttpClient


class AgentClient:
    def __init__(self) -> None:
        settings = get_settings().agent_client
        self._http = InternalHttpClient(
            base_url=settings.base_url,
            timeout=httpx.Timeout(connect=5.0, read=60.0, write=30.0, pool=5.0),
            limits=httpx.Limits(
                max_connections=settings.http_max_connections,
                max_keepalive_connections=settings.http_max_keepalive_connections,
            ),
        )
        self._stream_timeout = httpx.Timeout(connect=5.0, read=None, write=10.0, pool=5.0)

    async def aclose(self) -> None:
        await self._http.aclose()

    async def create_session(
        self,
        *,
        user_id: str,
        agent_id: str,
        name: str,
        chat_model_config: dict[str, Any],
        knowledge_config: dict[str, Any] | None = None,
    ) -> str:
        body: dict[str, Any] = {
            "agent_id": agent_id,
            "name": name,
            "chat_model_config": chat_model_config,
        }
        if knowledge_config is not None:
            body["knowledge_config"] = knowledge_config
        response = await self._http.request(
            "POST",
            "/sessions/",
            user_id=user_id,
            json=body,
        )
        try:
            payload = response.json()
        except ValueError as exc:
            raise RemoteServiceError(502, "invalid create session response") from exc
        if not isinstance(payload, dict) or not isinstance(payload.get("session_id"), str):
            raise RemoteServiceError(502, "invalid create session response")
        return payload["session_id"]

    async def delete_session(self, *, user_id: str, agent_id: str, session_id: str) -> bool:
        try:
            await self._http.request(
                "DELETE",
                f"/sessions/{session_id}",
                user_id=user_id,
                params={"agent_id": agent_id},
            )
        except RemoteServiceError as exc:
            if exc.status_code == 404:
                return False
            raise
        return True

    async def trigger_chat(
        self,
        *,
        user_id: str,
        agent_id: str,
        session_id: str,
        payload: Any,
    ) -> dict[str, Any]:
        response = await self._http.request(
            "POST",
            "/chat/",
            user_id=user_id,
            json={"agent_id": agent_id, "session_id": session_id, "input": payload},
        )
        return response.json()

    async def interrupt(self, *, user_id: str, agent_id: str, session_id: str) -> dict[str, Any]:
        response = await self._http.request(
            "POST",
            f"/sessions/{session_id}/interrupt",
            user_id=user_id,
            params={"agent_id": agent_id},
        )
        return response.json()

    async def list_messages(
        self,
        *,
        user_id: str,
        agent_id: str,
        session_id: str,
        before: str | None,
        limit: int,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {"agent_id": agent_id, "limit": limit}
        if before:
            params["before"] = before
        response = await self._http.request(
            "GET",
            f"/sessions/{session_id}/messages",
            user_id=user_id,
            params=params,
        )
        return response.json()

    async def list_memory_entries(
        self,
        *,
        user_id: str,
        kind: str,
        limit: int,
        offset: int,
        date: str | None,
        session_id: str | None,
    ) -> MemoryEntryListDTO:
        params: dict[str, Any] = {"kind": kind, "limit": limit, "offset": offset}
        if date:
            params["date"] = date
        if session_id:
            params["session_id"] = session_id
        response = await self._http.request(
            "GET",
            "/memory/entries",
            user_id=user_id,
            params=params,
        )
        return MemoryEntryListDTO.model_validate(response.json())

    async def get_memory_entry(
        self,
        *,
        user_id: str,
        entry_id: str,
    ) -> MemoryEntryDetailDTO:
        response = await self._http.request(
            "GET",
            f"/memory/entries/{entry_id}",
            user_id=user_id,
        )
        return MemoryEntryDetailDTO.model_validate(response.json())

    async def list_knowledge_bases(
        self,
        *,
        user_id: str,
        knowledge_base_id: str | None = None,
        page: int = 1,
        page_size: int = 128,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {"page": page, "page_size": page_size}
        if knowledge_base_id:
            params["id"] = knowledge_base_id
        response = await self._http.request(
            "GET",
            "/knowledge_bases/",
            user_id=user_id,
            params=params,
        )
        return response.json()

    async def create_knowledge_base(
        self,
        *,
        user_id: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        response = await self._http.request(
            "POST",
            "/knowledge_bases/",
            user_id=user_id,
            json=payload,
        )
        return response.json()

    async def update_knowledge_base(
        self,
        *,
        user_id: str,
        knowledge_base_id: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        response = await self._http.request(
            "PATCH",
            f"/knowledge_bases/{knowledge_base_id}",
            user_id=user_id,
            json=payload,
        )
        return response.json()

    async def delete_knowledge_base(
        self,
        *,
        user_id: str,
        knowledge_base_id: str,
    ) -> None:
        await self._http.request(
            "DELETE",
            f"/knowledge_bases/{knowledge_base_id}",
            user_id=user_id,
        )

    async def list_knowledge_documents(
        self,
        *,
        user_id: str,
        knowledge_base_id: str,
        page: int = 1,
        page_size: int = 128,
    ) -> dict[str, Any]:
        response = await self._http.request(
            "GET",
            f"/knowledge_bases/{knowledge_base_id}/documents",
            user_id=user_id,
            params={"page": page, "page_size": page_size},
        )
        return response.json()

    async def list_knowledge_document_status(
        self,
        *,
        user_id: str,
        knowledge_base_id: str,
        document_ids: list[str],
    ) -> dict[str, Any]:
        response = await self._http.request(
            "GET",
            f"/knowledge_bases/{knowledge_base_id}/documents/status",
            user_id=user_id,
            params={"ids": ",".join(document_ids)},
        )
        return response.json()

    async def upload_knowledge_document(
        self,
        *,
        user_id: str,
        knowledge_base_id: str,
        filename: str,
        content: bytes,
        content_type: str,
    ) -> dict[str, Any]:
        response = await self._http.request(
            "POST",
            f"/knowledge_bases/{knowledge_base_id}/documents",
            user_id=user_id,
            files={"file": (filename, content, content_type)},
            data={"content_type": content_type},
            timeout=httpx.Timeout(connect=5.0, read=120.0, write=120.0, pool=5.0),
        )
        return response.json()

    async def delete_knowledge_document(
        self,
        *,
        user_id: str,
        knowledge_base_id: str,
        document_id: str,
    ) -> None:
        await self._http.request(
            "DELETE",
            f"/knowledge_bases/{knowledge_base_id}/documents/{document_id}",
            user_id=user_id,
        )

    @asynccontextmanager
    async def stream_knowledge_document(
        self,
        *,
        user_id: str,
        knowledge_base_id: str,
        document_id: str,
        download: bool,
    ) -> AsyncGenerator[httpx.Response]:
        params = {"download": "true"} if download else {}
        async with self._http.stream(
            "GET",
            f"/knowledge_bases/{knowledge_base_id}/documents/{document_id}",
            user_id=user_id,
            params=params,
            headers={"Accept-Encoding": "identity"},
            timeout=httpx.Timeout(connect=5.0, read=None, write=30.0, pool=5.0),
        ) as response:
            yield response

    async def get_status(
        self,
        *,
        user_id: str,
        agent_id: str,
        session_id: str,
    ) -> dict[str, Any]:
        response = await self._http.request(
            "GET",
            f"/sessions/{session_id}/status",
            user_id=user_id,
            params={"agent_id": agent_id},
        )
        return response.json()

    @asynccontextmanager
    async def stream_events(
        self,
        *,
        user_id: str,
        agent_id: str,
        session_id: str,
        after: str | None,
    ) -> AsyncGenerator[httpx.Response]:
        params: dict[str, Any] = {"agent_id": agent_id}
        if after:
            params["after"] = after
        async with self._http.stream(
            "GET",
            f"/sessions/{session_id}/stream",
            user_id=user_id,
            params=params,
            headers={"Accept-Encoding": "identity"},
            timeout=self._stream_timeout,
        ) as response:
            yield response


_client: AgentClient | None = None


def get_agent_client() -> AgentClient:
    global _client
    if _client is None:
        _client = AgentClient()
    return _client


async def close_agent_client() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
