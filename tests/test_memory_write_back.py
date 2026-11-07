import asyncio
from pathlib import Path

import pytest
from agentscope.message import Msg, UserMsg
from agentscope.middleware import ReMeMiddleware

from app.agent.runtime.memory import _BackgroundWriteReMeMiddleware


def _msg(text: str) -> Msg:
    return UserMsg(name="user", content=text)


@pytest.mark.asyncio
async def test_write_back_returns_before_job_finishes(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    started = asyncio.Event()
    release = asyncio.Event()
    calls: list[tuple[str, str | None]] = []

    async def fake_write_back(
        self: ReMeMiddleware,
        messages: list[Msg],
        session_id: str | None,
    ) -> None:
        calls.append((messages[0].get_text_content() or "", session_id))
        started.set()
        await release.wait()

    monkeypatch.setattr(ReMeMiddleware, "_write_back", fake_write_back)

    memory = _BackgroundWriteReMeMiddleware(workspace_dir=str(tmp_path))
    try:
        await asyncio.wait_for(memory._write_back([_msg("turn-1")], "session-1"), timeout=1)
        await asyncio.wait_for(started.wait(), timeout=1)

        assert calls == [("turn-1", "session-1")]
        assert not release.is_set()

        release.set()
        await asyncio.wait_for(memory._write_queue.join(), timeout=1)
    finally:
        await memory.close()


@pytest.mark.asyncio
async def test_write_back_is_serialized_per_user(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    first_started = asyncio.Event()
    release_first = asyncio.Event()
    order: list[str] = []

    async def fake_write_back(
        self: ReMeMiddleware,
        messages: list[Msg],
        session_id: str | None,
    ) -> None:
        text = messages[0].get_text_content() or ""
        order.append(text)
        if text == "turn-1":
            first_started.set()
            await release_first.wait()

    monkeypatch.setattr(ReMeMiddleware, "_write_back", fake_write_back)

    memory = _BackgroundWriteReMeMiddleware(workspace_dir=str(tmp_path))
    try:
        await memory._write_back([_msg("turn-1")], "session-1")
        await memory._write_back([_msg("turn-2")], "session-1")
        await asyncio.wait_for(first_started.wait(), timeout=1)

        assert order == ["turn-1"]

        release_first.set()
        await asyncio.wait_for(memory._write_queue.join(), timeout=1)
        assert order == ["turn-1", "turn-2"]
    finally:
        await memory.close()


@pytest.mark.asyncio
async def test_flush_waits_for_pending_writes(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    started = asyncio.Event()
    release = asyncio.Event()
    finished: list[str] = []

    async def fake_write_back(
        self: ReMeMiddleware,
        messages: list[Msg],
        session_id: str | None,
    ) -> None:
        started.set()
        await release.wait()
        finished.append(messages[0].get_text_content() or "")

    monkeypatch.setattr(ReMeMiddleware, "_write_back", fake_write_back)

    memory = _BackgroundWriteReMeMiddleware(workspace_dir=str(tmp_path))
    try:
        await memory._write_back([_msg("turn-1")], "session-1")
        await asyncio.wait_for(started.wait(), timeout=1)

        release.set()
        await asyncio.wait_for(memory.flush(), timeout=1)

        assert finished == ["turn-1"]
    finally:
        await memory.close()
