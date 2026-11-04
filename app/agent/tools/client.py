from typing import Any

import httpx

from app.api.endpoints.schemas.internal_question import (
    USER_ID_HEADER,
    AnswerWriteRequest,
)
from app.core.config import get_settings

# 与 app/api/endpoints/internal_question.py 的路由保持一致
ANSWER_WRITE_PATH = "/api/internal/questions/answers"


class InternalApiError(RuntimeError):
    """内部接口不可用, 或返回了业务错误。"""


def _error_detail(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        return ""
    if isinstance(payload, dict) and isinstance(payload.get("detail"), str):
        return payload["detail"]
    return ""


class InternalApiClient:
    """API 进程内部接口的异步客户端。"""

    def __init__(self, base_url: str) -> None:
        self._http = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            timeout=httpx.Timeout(connect=5.0, read=15.0, write=15.0, pool=5.0),
            # 两个进程都在本机/内网, 不能被 shell 里的代理环境变量接管
            trust_env=False,
        )

    async def aclose(self) -> None:
        await self._http.aclose()

    async def write_answer(
        self,
        user_id: str,
        payload: AnswerWriteRequest,
    ) -> bool:
        """回写一次「出题 + 作答」, 同 tool_call_id 重放时幂等。"""
        response = await self._request(
            "POST",
            ANSWER_WRITE_PATH,
            user_id=user_id,
            json=payload.model_dump(mode="json"),
        )
        return bool(response.json())

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
            raise InternalApiError("内部服务暂时不可用") from exc
        if response.status_code >= 400:
            detail = _error_detail(response)
            raise InternalApiError(detail or f"内部服务返回 {response.status_code}")
        return response


_client: InternalApiClient | None = None


def get_client() -> InternalApiClient:
    """进程内复用连接池; 首次调用发生在运行中的事件循环里。"""
    global _client
    if _client is None:
        _client = InternalApiClient(get_settings().api_base_url)
    return _client


async def close_client() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
