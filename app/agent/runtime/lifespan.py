from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI

from app.agent.runtime.knowledge import verify_qdrant
from app.agent.runtime.memory import close_all
from app.core.config import Settings


def wrap_lifespan(app: FastAPI, settings: Settings) -> None:
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
