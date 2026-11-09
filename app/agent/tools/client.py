import httpx

from app.shared.config import get_settings
from app.shared.dto.internal_question import AnswerRelayRequest
from app.shared.dto.internal_usage import ReplyUsageReport
from app.shared.http import InternalHttpClient

ANSWER_WRITE_PATH = "/api/internal/questions/answers"
USAGE_REPLY_WRITE_PATH = "/api/internal/usage/replies"


class InternalApiClient:
    def __init__(self, base_url: str) -> None:
        self._http = InternalHttpClient(
            base_url=base_url,
            timeout=httpx.Timeout(connect=5.0, read=15.0, write=15.0, pool=5.0),
        )

    async def aclose(self) -> None:
        await self._http.aclose()

    async def write_answer(
        self,
        user_id: str,
        payload: AnswerRelayRequest,
    ) -> bool:
        response = await self._http.request(
            "POST",
            ANSWER_WRITE_PATH,
            user_id=user_id,
            json=payload.model_dump(mode="json"),
        )
        return bool(response.json())

    async def report_reply_usage(
        self,
        user_id: str,
        payload: ReplyUsageReport,
    ) -> bool:
        response = await self._http.request(
            "POST",
            USAGE_REPLY_WRITE_PATH,
            user_id=user_id,
            json=payload.model_dump(mode="json"),
            timeout=5.0,
        )
        return bool(response.json())


_client: InternalApiClient | None = None


def get_client() -> InternalApiClient:
    global _client
    if _client is None:
        _client = InternalApiClient(get_settings().api.base_url)
    return _client


async def close_client() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
