import logging
from typing import Any, Protocol

from agentscope.message import DataBlock, TextBlock, ToolResultState, URLSource
from agentscope.permission import (
    PermissionBehavior,
    PermissionContext,
    PermissionDecision,
)
from agentscope.tool import ToolBase, ToolChunk

from app.agent.tools.schemas.materials import (
    MaterialsGrepInput,
    MaterialsLsInput,
    MaterialsReadInput,
)
from app.shared.errors import RemoteServiceError

logger = logging.getLogger(__name__)

_LS_DESCRIPTION = (
    "列出资料库中某个目录的内容, 类似 ls。目录名以 `/` 结尾; 路径不确定时先用它逐层确认, 再读文件。"
)
_READ_DESCRIPTION = (
    "按行读取资料库中的单个文本文件, 类似 cat, 会去掉文件顶部的 YAML frontmatter。"
    "只能读文件不能读目录; "
    "只读当前问题需要的一两节, 不要整章或整本加载。"
)
_GREP_DESCRIPTION = (
    "在资料库中做不区分大小写的字面子串搜索, 类似 grep, 不是正则。"
    "已知关键词但不确定文件位置时, 先用它定位, 再用 materials_read 读命中处。"
    "返回 `文件路径:行号: 内容`; 没有命中时返回「未找到」。"
)


class MaterialsClient(Protocol):
    async def list_material_children(self, user_id: str, path: str) -> dict: ...

    async def read_material(
        self,
        user_id: str,
        path: str,
        offset: int,
        limit: int,
        include_images: bool,
        max_images: int,
    ) -> dict: ...

    async def search_materials(
        self,
        user_id: str,
        query: str,
        path: str,
        limit: int,
    ) -> dict: ...


class _MaterialsTool(ToolBase):
    is_read_only: bool = True
    is_concurrency_safe: bool = True

    def __init__(self, client: MaterialsClient, user_id: str) -> None:
        super().__init__()
        self._client = client
        self._user_id = user_id

    async def check_permissions(
        self,
        tool_input: dict[str, Any],
        context: PermissionContext,
    ) -> PermissionDecision:
        del tool_input, context
        return PermissionDecision(
            behavior=PermissionBehavior.ALLOW,
            message="资料库只读",
        )

    def _error(self, message: str) -> ToolChunk:
        return ToolChunk(
            content=[TextBlock(text=message)],
            state=ToolResultState.ERROR,
        )

    def _failure(self, exc: RemoteServiceError, *, missing: str) -> ToolChunk:
        if exc.status_code == 404:
            return self._error(missing)
        logger.warning("资料库请求失败: status=%s detail=%s", exc.status_code, exc.detail)
        return self._error("资料库读取失败")


class MaterialsLs(_MaterialsTool):
    name: str = "materials_ls"
    description: str = _LS_DESCRIPTION
    input_schema: dict[str, Any] = MaterialsLsInput.model_json_schema()

    async def call(self, **kwargs: Any) -> ToolChunk:
        data = MaterialsLsInput.model_validate(kwargs)
        try:
            payload = await self._client.list_material_children(self._user_id, data.path)
        except RemoteServiceError as exc:
            return self._failure(
                exc,
                missing=f"路径不存在: {data.path}; 用 materials_ls 从 `/` 开始逐层确认",
            )
        entries = [
            (
                f"{item['name']}/"
                if item["kind"] == "folder"
                else str(item["path"]).rsplit("/", 1)[-1]
            )
            for item in payload.get("items", [])
        ]
        return ToolChunk(content=[TextBlock(text="\n".join(entries) or "空目录")])


class MaterialsRead(_MaterialsTool):
    name: str = "materials_read"
    description: str = _READ_DESCRIPTION
    input_schema: dict[str, Any] = MaterialsReadInput.model_json_schema()

    async def call(self, **kwargs: Any) -> ToolChunk:
        data = MaterialsReadInput.model_validate(kwargs)
        try:
            payload = await self._client.read_material(
                self._user_id,
                data.path,
                data.offset,
                data.limit,
                data.include_images,
                data.max_images,
            )
        except RemoteServiceError as exc:
            return self._failure(
                exc,
                missing=f"文件不存在: {data.path}; 用 materials_ls 或 materials_grep 确认路径",
            )
        content: list[TextBlock | DataBlock] = [
            TextBlock(text=payload.get("content", "") or "空文件")
        ]
        for image in payload.get("images", []):
            url = image.get("url", "")
            content_type = image.get("content_type", "")
            if not url or not content_type:
                continue
            content.append(
                DataBlock(
                    source=URLSource(
                        url=url,
                        media_type=content_type,
                    ),
                    name=image.get("name", ""),
                )
            )
        return ToolChunk(content=content)


class MaterialsGrep(_MaterialsTool):
    name: str = "materials_grep"
    description: str = _GREP_DESCRIPTION
    input_schema: dict[str, Any] = MaterialsGrepInput.model_json_schema()

    async def call(self, **kwargs: Any) -> ToolChunk:
        data = MaterialsGrepInput.model_validate(kwargs)
        try:
            payload = await self._client.search_materials(
                self._user_id,
                data.query,
                data.path,
                data.limit,
            )
        except RemoteServiceError as exc:
            return self._failure(
                exc,
                missing=f"路径不存在: {data.path}; 用 materials_ls 确认搜索范围",
            )
        lines = [
            f"{item['path']}:{item['line']}: {item['text']}"
            for item in payload.get("items", [])
        ]
        return ToolChunk(content=[TextBlock(text="\n".join(lines) or "未找到")])
