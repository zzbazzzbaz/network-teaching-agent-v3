from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlmodel import SQLModel

from app.shared.config import get_settings

engine: AsyncEngine = create_async_engine(
    get_settings().db.url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_recycle=1800,
    echo=False,
    connect_args={"server_settings": {"timezone": "UTC"}},
)

SessionFactory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


@asynccontextmanager
async def session_scope() -> AsyncGenerator[AsyncSession]:
    """事务边界: 正常退出提交, 异常回滚。"""
    async with SessionFactory() as session:
        try:
            yield session
        except BaseException:
            await session.rollback()
            raise
        else:
            await session.commit()


_MIGRATION_DDL = (
    """
    DO $$
    BEGIN
        CREATE TYPE userrole AS ENUM ('STUDENT', 'ADMIN');
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END
    $$;
    """,
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS role userrole NOT NULL DEFAULT 'STUDENT'",
    "CREATE INDEX IF NOT EXISTS ix_users_role ON users(role)",
    """
    ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS knowledge_base_ids jsonb NOT NULL DEFAULT '[]'::jsonb
    """,
    "ALTER TYPE agentkind ADD VALUE IF NOT EXISTS 'EXAM'",
)


async def create_db_and_tables() -> None:
    from app.api.repositories import models  # noqa: F401  注册 metadata

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
        for statement in _MIGRATION_DDL:
            await conn.execute(text(statement))


async def close_db() -> None:
    await engine.dispose()
