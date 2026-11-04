import asyncio
from collections import OrderedDict

from agentscope.middleware import ReMeMiddleware

from app.agent.runtime.models import build_chat_model, build_embedding_model
from app.core.config import Settings

# 每个实例都带一个文件监听和一个 23:00 的 dream cron, 必须有上限。
_MAX_CACHED = 256

_CACHE: OrderedDict[str, ReMeMiddleware] = OrderedDict()
_LOCK = asyncio.Lock()


async def get_memory(settings: Settings, user_id: str) -> ReMeMiddleware:
    """按学生缓存 ReMe 实例: 每轮新建会泄漏文件监听与定时任务。"""
    cached = _CACHE.get(user_id)
    if cached is not None:
        _CACHE.move_to_end(user_id)
        return cached

    async with _LOCK:
        cached = _CACHE.get(user_id)
        if cached is not None:
            _CACHE.move_to_end(user_id)
            return cached

        memory = ReMeMiddleware(
            workspace_dir=str(settings.memory_dir / user_id),
            parameters=ReMeMiddleware.Parameters(
                chat_model=build_chat_model(settings),
                embedding_model=build_embedding_model(settings),
                mode="agent_control",
                top_k=5,
            ),
        )
        _CACHE[user_id] = memory
        await _evict_overflow()
        return memory


async def _evict_overflow() -> None:
    overflow = len(_CACHE) - _MAX_CACHED
    if overflow <= 0:
        return
    evicted = [_CACHE.popitem(last=False)[1] for _ in range(overflow)]
    await asyncio.gather(*(memory.close() for memory in evicted), return_exceptions=True)


async def close_all() -> None:
    memories = list(_CACHE.values())
    _CACHE.clear()
    await asyncio.gather(*(memory.close() for memory in memories), return_exceptions=True)
