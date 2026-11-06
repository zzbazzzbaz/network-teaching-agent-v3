import json
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.constants import USER_ID_HEADER


class AgentError(Exception):
    def __init__(self, status_code: int, detail: str = "") -> None:
        super().__init__(detail or f"agent returned {status_code}")
        self.status_code = status_code
        self.detail = detail


class AgentUnavailableError(AgentError):
    def __init__(self, detail: str = "agent unreachable") -> None:
        super().__init__(status_code=503, detail=detail)


def _detail_from_payload(payload: Any) -> str:
    if isinstance(payload, dict) and isinstance(payload.get("detail"), str):
        return payload["detail"]
    return ""


def _detail_from_body(body: bytes) -> str:
    try:
        payload = json.loads(body)
    except ValueError:
        return ""
    return _detail_from_payload(payload)


class AgentClient:
    def __init__(self) -> None:
        settings = get_settings()
        self._http = httpx.AsyncClient(
            base_url=settings.agent_base_url.rstrip("/"),
            timeout=httpx.Timeout(connect=5.0, read=60.0, write=30.0, pool=5.0),
            limits=httpx.Limits(
                max_connections=settings.agent_http_max_connections,
                max_keepalive_connections=settings.agent_http_max_keepalive_connections,
            ),
            trust_env=False,
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
    ) -> str:
        response = await self._request(
            "POST",
            "/sessions/",
            user_id=user_id,
            json={
                "agent_id": agent_id,
                "name": name,
                "chat_model_config": chat_model_config,
            },
        )
        payload = _safe_json(response)
        if not isinstance(payload, dict) or not isinstance(payload.get("session_id"), str):
            raise AgentError(502, "invalid create session response")
        return payload["session_id"]

    async def delete_session(self, *, user_id: str, agent_id: str, session_id: str) -> bool:
        try:
            await self._request(
                "DELETE",
                f"/sessions/{session_id}",
                user_id=user_id,
                params={"agent_id": agent_id},
            )
        except AgentError as exc:
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
        response = await self._request(
            "POST",
            "/chat/",
            user_id=user_id,
            json={"agent_id": agent_id, "session_id": session_id, "input": payload},
        )
        return response.json()

    async def interrupt(self, *, user_id: str, agent_id: str, session_id: str) -> dict[str, Any]:
        response = await self._request(
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
        response = await self._request(
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
    ) -> dict[str, Any]:
        params: dict[str, Any] = {"kind": kind, "limit": limit, "offset": offset}
        if date:
            params["date"] = date
        if session_id:
            params["session_id"] = session_id
        response = await self._request(
            "GET",
            "/memory/entries",
            user_id=user_id,
            params=params,
        )
        return response.json()

    async def get_memory_entry(self, *, user_id: str, entry_id: str) -> dict[str, Any]:
        response = await self._request(
            "GET",
            f"/memory/entries/{entry_id}",
            user_id=user_id,
        )
        return response.json()

    async def get_status(
        self,
        *,
        user_id: str,
        agent_id: str,
        session_id: str,
    ) -> dict[str, Any]:
        response = await self._request(
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
        try:
            async with self._http.stream(
                "GET",
                f"/sessions/{session_id}/stream",
                params=params,
                headers={USER_ID_HEADER: user_id, "Accept-Encoding": "identity"},
                timeout=self._stream_timeout,
            ) as response:
                if response.status_code >= 400:
                    body = await response.aread()
                    raise AgentError(response.status_code, _detail_from_body(body))
                yield response
        except httpx.HTTPError as exc:
            raise AgentUnavailableError from exc

    async def _request(
        self,
        method: str,
        path: str,
        *,
        user_id: str,
        **kwargs: Any,
    ) -> httpx.Response:
        try:
            response = await self._http.request(
                method,
                path,
                headers={USER_ID_HEADER: user_id},
                **kwargs,
            )
        except httpx.HTTPError as exc:
            raise AgentUnavailableError from exc
        if response.status_code >= 400:
            raise AgentError(response.status_code, _detail_from_payload(_safe_json(response)))
        return response


def _safe_json(response: httpx.Response) -> Any:
    try:
        return response.json()
    except ValueError:
        return None


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
