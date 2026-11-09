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
        _self: ReMeMiddleware,
        messages: list[Msg],
        _session_id: str | None,
    ) -> None:
        calls.append((messages[0].get_text_content() or "", _session_id))
        started.set()
        await release.wait()

    monkeypatch.setattr(
        _BackgroundWriteReMeMiddleware,
        "_persist",
        fake_write_back,
    )

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
async def test_write_back_passes_student_profile_hint(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    calls: list[tuple[str, dict]] = []

    async def fake_run_job(
        _self: ReMeMiddleware,
        name: str,
        **kwargs,
    ) -> None:
        calls.append((name, kwargs))

    monkeypatch.setattr(ReMeMiddleware, "_run_job", fake_run_job)

    memory = _BackgroundWriteReMeMiddleware(workspace_dir=str(tmp_path))
    try:
        await memory._persist([_msg("turn-1")], "session-1")
    finally:
        await memory.close()

    assert calls[0][0] == "auto_memory"
    assert calls[0][1]["session_id"] == "session-1"
    assert "学生画像" in calls[0][1]["memory_hint"]
    assert "会话进度" in calls[0][1]["memory_hint"]


@pytest.mark.asyncio
async def test_write_back_is_serialized_per_user(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    first_started = asyncio.Event()
    release_first = asyncio.Event()
    order: list[str] = []

    async def fake_write_back(
        _self: ReMeMiddleware,
        messages: list[Msg],
        _session_id: str | None,
    ) -> None:
        text = messages[0].get_text_content() or ""
        order.append(text)
        if text == "turn-1":
            first_started.set()
            await release_first.wait()

    monkeypatch.setattr(
        _BackgroundWriteReMeMiddleware,
        "_persist",
        fake_write_back,
    )

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
        _self: ReMeMiddleware,
        messages: list[Msg],
        _session_id: str | None,
    ) -> None:
        started.set()
        await release.wait()
        finished.append(messages[0].get_text_content() or "")

    monkeypatch.setattr(
        _BackgroundWriteReMeMiddleware,
        "_persist",
        fake_write_back,
    )

    memory = _BackgroundWriteReMeMiddleware(workspace_dir=str(tmp_path))
    try:
        await memory._write_back([_msg("turn-1")], "session-1")
        await asyncio.wait_for(started.wait(), timeout=1)

        release.set()
        await asyncio.wait_for(memory.flush(), timeout=1)

        assert finished == ["turn-1"]
    finally:
        await memory.close()
