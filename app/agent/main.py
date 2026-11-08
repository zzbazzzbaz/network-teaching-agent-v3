import logging
from typing import Any, cast

import fastapi
from agentscope.app import create_app
from agentscope.app.message_bus import RedisMessageBus
from agentscope.app.storage import RedisStorage
from agentscope.rag import ApproxTokenChunker
from fastapi import FastAPI

from app.agent.endpoints import api_router
from app.agent.lifespan import wrap_lifespan
from app.agent.runtime.access import build_access_policy
from app.agent.runtime.knowledge import (
    build_knowledge_base_manager,
    build_knowledge_blob_store,
    build_knowledge_parsers,
)
from app.agent.runtime.middlewares import agent_middlewares
from app.agent.runtime.tracing import setup_tracing
from app.agent.runtime.workspace import build_workspace_manager
from app.agent.tools import agent_tools
from app.shared.config import get_settings


class _NoTelemetryFastAPI(FastAPI):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        kwargs.setdefault(
            "telemetry",
            {
                "tracing": False,
                "metrics": False,
                "logs": False,
                "operation_spans": False,
            },
        )
        super().__init__(*args, **kwargs)


def _create_app(**kwargs: Any) -> FastAPI:
    original = fastapi.FastAPI
    fastapi.FastAPI = cast(Any, _NoTelemetryFastAPI)
    try:
        return create_app(**kwargs)
    finally:
        fastapi.FastAPI = cast(Any, original)


def create_agent_app() -> FastAPI:
    settings = get_settings()
    setup_tracing(settings.langfuse)
    storage = RedisStorage(
        host=settings.redis.host,
        port=settings.redis.port,
        db=1,
        password=settings.redis.password,
        max_connections=settings.redis.max_connections,
    )
    message_bus = RedisMessageBus(
        host=settings.redis.host,
        port=settings.redis.port,
        db=2,
        password=settings.redis.password,
        max_connections=settings.redis.max_connections,
    )
    app = _create_app(
        storage=storage,
        message_bus=message_bus,
        workspace_manager=build_workspace_manager(settings),
        knowledge_base_manager=build_knowledge_base_manager(storage, settings),
        knowledge_parsers=build_knowledge_parsers(),
        knowledge_chunkers=[ApproxTokenChunker],
        blob_store=build_knowledge_blob_store(settings),
        resource_access_policy=build_access_policy(),
        extra_agent_middlewares=agent_middlewares,
        extra_agent_tools=agent_tools,
        enable_scheduler=False,
        enable_channel_worker=False,
        title="计算机网络教学智能体 Agent",
        version="0.1.0",
    )
    app.include_router(api_router)
    wrap_lifespan(app, settings)
    return app


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

app = create_agent_app()
