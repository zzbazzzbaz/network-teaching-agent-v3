from typing import Any, cast

import pytest
from agentscope.tool import ToolGroup, Toolkit

from app.agent.runtime.middlewares import MemoryOnlyToolsMiddleware


class _Agent:
    def __init__(self, toolkit: Toolkit) -> None:
        self.toolkit = toolkit


@pytest.mark.asyncio
async def test_strip_schedule_group_removes_meta_tool() -> None:
    toolkit = Toolkit(
        tools=[],
        tool_groups=[ToolGroup(name="schedule_tools", description="", tools=[])],
    )
    before = [schema["function"]["name"] for schema in await toolkit.get_tool_schemas()]
    assert "reset_tools" in before

    middleware = MemoryOnlyToolsMiddleware()

    async def next_handler(**kwargs):
        del kwargs
        yield [schema["function"]["name"] for schema in await toolkit.get_tool_schemas()]

    result: list[str] = []
    async for item in middleware.on_reply(cast(Any, _Agent(toolkit)), {}, next_handler):
        result = item

    assert result == []
    assert [group.name for group in toolkit.tool_groups] == ["basic"]
