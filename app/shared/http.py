from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

import httpx

from app.core.constants import USER_ID_HEADER
from app.shared.errors import (
    RemoteServiceError,
    RemoteServiceUnavailableError,
    detail_from_body,
    detail_from_payload,
)


class InternalHttpClient:
    def __init__(
        self,
        *,
        base_url: str,
        timeout: httpx.Timeout,
        limits: httpx.Limits | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._http = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            timeout=timeout,
            limits=limits or httpx.Limits(),
            transport=transport,
            trust_env=False,
        )

    async def aclose(self) -> None:
        await self._http.aclose()

    async def request(
        self,
        method: str,
        path: str,
        *,
        user_id: str,
        **kwargs: Any,
    ) -> httpx.Response:
        headers = {USER_ID_HEADER: user_id}
        extra_headers = kwargs.pop("headers", None)
        if extra_headers:
            headers.update(extra_headers)
        try:
            response = await self._http.request(method, path, headers=headers, **kwargs)
        except httpx.HTTPError as exc:
            raise RemoteServiceUnavailableError from exc
        if response.status_code >= 400:
            raise RemoteServiceError(
                response.status_code,
                detail_from_payload(_safe_json(response)),
            )
        return response

    @asynccontextmanager
    async def stream(
        self,
        method: str,
        path: str,
        *,
        user_id: str,
        headers: dict[str, str] | None = None,
        **kwargs: Any,
    ) -> AsyncGenerator[httpx.Response]:
        request_headers = {USER_ID_HEADER: user_id}
        if headers:
            request_headers.update(headers)
        try:
            async with self._http.stream(
                method,
                path,
                headers=request_headers,
                **kwargs,
            ) as response:
                if response.status_code >= 400:
                    body = await response.aread()
                    raise RemoteServiceError(
                        response.status_code,
                        detail_from_body(body),
                    )
                yield response
        except httpx.HTTPError as exc:
            raise RemoteServiceUnavailableError from exc


def _safe_json(response: httpx.Response) -> Any:
    try:
        return response.json()
    except ValueError:
        return None
