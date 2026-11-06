from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.core.database import close_db, create_db_and_tables
from app.api.infra.agent_client import close_agent_client


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    await create_db_and_tables()
    try:
        yield
    finally:
        await close_agent_client()
        await close_db()
