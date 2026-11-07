from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI

from app.agent.runtime.memory import close_all
from app.agent.runtime.seed import ensure_seed
from app.agent.tools.client import close_client
from app.shared.config import Settings


def wrap_lifespan(app: FastAPI, settings: Settings) -> None:
    original = app.router.lifespan_context

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[Any]:
        async with original(app) as state:
            try:
                await ensure_seed(app.state.storage, settings)
                yield state
            finally:
                await close_client()
                await close_all()

    app.router.lifespan_context = lifespan
