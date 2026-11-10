import uuid

import pytest
from agentscope.message import DataBlock, TextBlock, ToolResultState

from app.agent.tools.materials import MaterialsGrep, MaterialsLs, MaterialsRead
from app.shared.errors import RemoteServiceError


def _text(chunk) -> str:
    return "\n".join(block.text for block in chunk.content if isinstance(block, TextBlock))


class FakeMaterialsClient:
    def __init__(self) -> None:
        self.ls = {
            "path": "/",
            "items": [
                {
                    "id": str(uuid.uuid4()),
                    "kind": "folder",
                    "name": "computer-networks-8e",
                    "path": "/computer-networks-8e",
                },
                {
                    "id": str(uuid.uuid4()),
                    "kind": "document",
                    "name": "step-demo.html",
                    "path": "/.templates/step-demo.html",
                },
            ],
        }
        self.read = {
            "id": str(uuid.uuid4()),
            "collection_id": str(uuid.uuid4()),
            "title": "1.1 小节",
            "path": "/test-book/01-章/1.1-小节.md",
            "content": "第一段\n第二段",
            "images": [
                {
                    "file_id": str(uuid.uuid4()),
                    "name": "fig-01.jpg",
                    "content_type": "image/jpeg",
                    "url": "https://cos.example.com/public/materials/fig-01.jpg",
                }
            ],
        }
        self.search = {
            "items": [
                {
                    "id": str(uuid.uuid4()),
                    "path": "/test-book/01-章/1.1-小节.md",
                    "line": 2,
                    "text": "第二段",
                }
            ]
        }
        self.error: RemoteServiceError | None = None
        self.captured: dict = {}

    async def list_material_children(self, user_id: str, path: str) -> dict:
        del user_id, path
        if self.error:
            raise self.error
        return self.ls

    async def read_material(
        self,
        user_id: str,
        path: str,
        offset: int,
        limit: int,
        include_images: bool,
        max_images: int,
    ) -> dict:
        self.captured.update(
            user_id=user_id,
            path=path,
            offset=offset,
            limit=limit,
            include_images=include_images,
            max_images=max_images,
        )
        if self.error:
            raise self.error
        return self.read

    async def search_materials(
        self,
        user_id: str,
        query: str,
        path: str,
        limit: int,
    ) -> dict:
        del user_id, query, path, limit
        if self.error:
            raise self.error
        return self.search


@pytest.mark.asyncio
async def test_ls_keeps_folder_suffix() -> None:
    tool = MaterialsLs(client=FakeMaterialsClient(), user_id="user-1")
    assert _text(await tool.call(path="/")) == ("computer-networks-8e/\nstep-demo.html")


@pytest.mark.asyncio
async def test_read_returns_text_and_images() -> None:
    tool = MaterialsRead(client=FakeMaterialsClient(), user_id="user-1")
    chunk = await tool.call(path="/test-book/01-章/1.1-小节.md")

    assert _text(chunk) == "第一段\n第二段"
    images = [block for block in chunk.content if isinstance(block, DataBlock)]
    assert len(images) == 1
    assert images[0].name == "fig-01.jpg"
    assert str(getattr(images[0].source, "url", "")) == (
        "https://cos.example.com/public/materials/fig-01.jpg"
    )


@pytest.mark.asyncio
async def test_read_passes_image_options() -> None:
    client = FakeMaterialsClient()
    tool = MaterialsRead(client=client, user_id="user-1")
    await tool.call(path="/x.md", offset=2, limit=10, include_images=False, max_images=3)

    assert client.captured == {
        "user_id": "user-1",
        "path": "/x.md",
        "offset": 2,
        "limit": 10,
        "include_images": False,
        "max_images": 3,
    }


@pytest.mark.asyncio
async def test_grep_formats_matches() -> None:
    tool = MaterialsGrep(client=FakeMaterialsClient(), user_id="user-1")
    text = _text(await tool.call(query="第二段"))
    assert text == "/test-book/01-章/1.1-小节.md:2: 第二段"


@pytest.mark.asyncio
async def test_grep_empty_returns_not_found() -> None:
    client = FakeMaterialsClient()
    client.search = {"items": []}
    tool = MaterialsGrep(client=client, user_id="user-1")
    assert _text(await tool.call(query="不存在")) == "未找到"


@pytest.mark.asyncio
async def test_missing_path_is_error() -> None:
    client = FakeMaterialsClient()
    client.error = RemoteServiceError(404, "资源不存在")
    chunk = await MaterialsRead(client=client, user_id="user-1").call(path="/missing.md")
    assert chunk.state == ToolResultState.ERROR
    assert "/missing.md" in _text(chunk)
