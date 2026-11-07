import asyncio
import contextlib
import logging
from collections import OrderedDict

from agentscope.message import Msg
from agentscope.middleware import ReMeMiddleware

from app.agent.runtime.models import build_chat_model, build_embedding_model
from app.shared.config import Settings

logger = logging.getLogger(__name__)

# 每个实例都带一个文件监听和一个 23:00 的 dream cron, 必须有上限。
_MAX_CACHED = 256
_WRITE_FLUSH_TIMEOUT_SECS = 30.0
_WRITE_QUEUE_WARN_SIZE = 8

_CACHE: OrderedDict[str, _BackgroundWriteReMeMiddleware] = OrderedDict()
_LOCK = asyncio.Lock()


class _BackgroundWriteReMeMiddleware(ReMeMiddleware):
    """把 ReMe 的记忆写回移到回复生命周期之外.

    ReMe 默认在 on_reply 的 finally 里同步等待 auto_memory,
    导致 chat run 在 REPLY_END 之后仍占用 session 数十秒,
    期间新的用户消息会被 ChatRunRegistry 以 409 拒绝.
    这里只把写回任务入队, 由每个学生一个的后台 worker 串行消费.
    """

    def __init__(
        self,
        *,
        workspace_dir: str = ".reme",
        parameters: ReMeMiddleware.Parameters | None = None,
    ) -> None:
        super().__init__(workspace_dir=workspace_dir, parameters=parameters)
        self._write_queue: asyncio.Queue[tuple[list[Msg], str | None]] = asyncio.Queue()
        self._write_worker: asyncio.Task[None] | None = None

    async def _write_back(self, messages: list[Msg], session_id: str | None) -> None:
        self._ensure_worker()
        pending = self._write_queue.qsize()
        if pending >= _WRITE_QUEUE_WARN_SIZE:
            logger.warning(
                "ReMe write queue backlog: pending=%d session_id=%s",
                pending,
                session_id,
            )
        await self._write_queue.put((messages, session_id))

    async def flush(self) -> None:
        if self._write_worker is None and self._write_queue.empty():
            return
        self._ensure_worker()
        try:
            await asyncio.wait_for(
                self._write_queue.join(),
                timeout=_WRITE_FLUSH_TIMEOUT_SECS,
            )
        except TimeoutError:
            logger.warning(
                "ReMe write flush timed out: pending=%d",
                self._write_queue.qsize(),
            )

    async def close(self) -> None:
        if self._write_worker is not None:
            pending = self._write_queue.qsize()
            if pending:
                logger.warning("ReMe write worker closed with pending=%d", pending)
            self._write_worker.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._write_worker
            self._write_worker = None
        await super().close()

    def _ensure_worker(self) -> None:
        if self._write_worker is None or self._write_worker.done():
            self._write_worker = asyncio.create_task(self._drain_writes())

    async def _drain_writes(self) -> None:
        while True:
            messages, session_id = await self._write_queue.get()
            try:
                await super()._write_back(messages, session_id)
            finally:
                self._write_queue.task_done()


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

        memory = _BackgroundWriteReMeMiddleware(
            workspace_dir=str(settings.storage.memory_dir / user_id),
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
    await asyncio.gather(*(memory.flush() for memory in memories), return_exceptions=True)
    await asyncio.gather(*(memory.close() for memory in memories), return_exceptions=True)
