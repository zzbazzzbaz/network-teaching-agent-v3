import httpx
import pytest

from app.shared.errors import RemoteServiceError, RemoteServiceUnavailableError
from app.shared.http import InternalHttpClient


@pytest.mark.asyncio
async def test_request_sends_user_header_and_maps_detail() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["X-User-ID"] == "user-1"
        return httpx.Response(404, json={"detail": "missing"})

    client = InternalHttpClient(
        base_url="http://test",
        timeout=httpx.Timeout(5.0),
        transport=httpx.MockTransport(handler),
    )
    try:
        with pytest.raises(RemoteServiceError) as exc_info:
            await client.request("GET", "/items", user_id="user-1")
    finally:
        await client.aclose()

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "missing"


@pytest.mark.asyncio
async def test_request_maps_transport_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("unreachable", request=request)

    client = InternalHttpClient(
        base_url="http://test",
        timeout=httpx.Timeout(5.0),
        transport=httpx.MockTransport(handler),
    )
    try:
        with pytest.raises(RemoteServiceUnavailableError):
            await client.request("GET", "/items", user_id="user-1")
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_stream_maps_error_body() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"detail": "bad request"})

    client = InternalHttpClient(
        base_url="http://test",
        timeout=httpx.Timeout(5.0),
        transport=httpx.MockTransport(handler),
    )
    try:
        with pytest.raises(RemoteServiceError) as exc_info:
            async with client.stream("GET", "/items", user_id="user-1"):
                pass
    finally:
        await client.aclose()

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "bad request"
