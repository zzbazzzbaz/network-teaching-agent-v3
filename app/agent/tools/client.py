import httpx

from app.shared.config import get_settings
from app.shared.dto.internal_question import AnswerRelayRequest
from app.shared.dto.internal_usage import ReplyUsageReport
from app.shared.http import InternalHttpClient

ANSWER_WRITE_PATH = "/api/internal/questions/answers"
USAGE_REPLY_WRITE_PATH = "/api/internal/usage/replies"
MATERIALS_LS_PATH = "/api/internal/materials/ls"
MATERIALS_READ_PATH = "/api/internal/materials/read"
MATERIALS_SEARCH_PATH = "/api/internal/materials/search"


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

    async def list_material_children(self, user_id: str, path: str) -> dict:
        response = await self._http.request(
            "GET",
            MATERIALS_LS_PATH,
            user_id=user_id,
            params={"path": path},
        )
        return response.json()

    async def read_material(
        self,
        user_id: str,
        path: str,
        offset: int,
        limit: int,
        include_images: bool,
        max_images: int,
    ) -> dict:
        response = await self._http.request(
            "GET",
            MATERIALS_READ_PATH,
            user_id=user_id,
            params={
                "path": path,
                "offset": offset,
                "limit": limit,
                "include_images": include_images,
                "max_images": max_images,
            },
        )
        return response.json()

    async def search_materials(
        self,
        user_id: str,
        query: str,
        path: str,
        limit: int,
    ) -> dict:
        response = await self._http.request(
            "GET",
            MATERIALS_SEARCH_PATH,
            user_id=user_id,
            params={"q": query, "path": path, "limit": limit},
        )
        return response.json()


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
