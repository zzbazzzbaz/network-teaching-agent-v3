import logging

from fastapi import FastAPI
from agentscope.app import create_app
from agentscope.app.message_bus import RedisMessageBus
from agentscope.app.storage import RedisStorage
from agentscope.app.workspace_manager import LocalWorkspaceManager

from app.core.config import get_settings


def create_agent_app() -> FastAPI:
    settings = get_settings()
    host, port, password = settings.redis.host, settings.redis.port, settings.redis.password
    return create_app(
        storage=RedisStorage(host=host, port=port, db=1, password=password),
        message_bus=RedisMessageBus(host=host, port=port, db=2, password=password),
        workspace_manager=LocalWorkspaceManager(str(settings.workspaces_dir)),
        enable_scheduler=False,
        enable_channel_worker=False,
        enable_index_worker=False,
        title="计算机网络教学智能体 Agent",
        version="0.1.0",
    )


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

app = create_app()
