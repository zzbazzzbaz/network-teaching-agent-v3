import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

from agentscope.app import create_app
from agentscope.app.message_bus import RedisMessageBus
from agentscope.app.storage import RedisStorage
from fastapi import FastAPI

from app.agent.knowledge import (
    build_access_policy,
    build_blob_store,
    build_kb_manager,
    build_parsers,
    verify_qdrant,
)
from app.agent.memory import close_all
from app.agent.middlewares import agent_middlewares
from app.agent.workspace import build_workspace_manager
from app.core.config import Settings, get_settings


def _wrap_lifespan(app: FastAPI, settings: Settings) -> None:
    """create_app 不透出钩子, 包一层做启动探活与退出清理。"""
    original = app.router.lifespan_context

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[Any]:
        async with original(app) as state:
            try:
                await verify_qdrant(settings.qdrant_url)
                yield state
            finally:
                await close_all()

    app.router.lifespan_context = lifespan


def create_agent_app() -> FastAPI:
    settings = get_settings()
    host, port, password = settings.redis.host, settings.redis.port, settings.redis.password
    storage = RedisStorage(host=host, port=port, db=1, password=password)
    app = create_app(
        storage=storage,
        message_bus=RedisMessageBus(host=host, port=port, db=2, password=password),
        workspace_manager=build_workspace_manager(settings),
        knowledge_base_manager=build_kb_manager(settings, storage),
        knowledge_parsers=build_parsers(),
        blob_store=build_blob_store(settings),
        resource_access_policy=build_access_policy(settings),
        extra_agent_middlewares=agent_middlewares,
        enable_index_worker=True,
        enable_scheduler=False,
        enable_channel_worker=False,
        title="计算机网络教学智能体 Agent",
        version="0.1.0",
    )
    _wrap_lifespan(app, settings)
    return app


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

app = create_agent_app()
