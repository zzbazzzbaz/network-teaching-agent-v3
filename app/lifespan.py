from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.database import close_db, create_db_and_tables


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """资源编排: 启动时建表, 关闭时释放连接池。"""
    await create_db_and_tables()
    try:
        yield
    finally:
        await close_db()
