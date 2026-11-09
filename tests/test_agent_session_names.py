import pytest

from app.api.infra.agent_client import parse_session_names
from app.shared.constants import SESSION_PLACEHOLDER_TITLE


def _payload(*sessions: dict) -> dict:
    return {"sessions": [{"session": session} for session in sessions], "total": len(sessions)}


def _session(session_id: str, name: str, auto: bool) -> dict:
    return {
        "id": session_id,
        "config": {
            "name": name,
            "naming": {"auto": auto},
        },
    }


def test_parse_session_names_reads_settled_names() -> None:
    names = parse_session_names(
        _payload(
            _session("11111111-1111-1111-1111-111111111111", " TCP 三次握手 ", auto=False),
            _session("22222222222222222222222222222222", "物理层接口特性", auto=False),
        ),
    )
    assert names == {
        "11111111111111111111111111111111": "TCP 三次握手",
        "22222222222222222222222222222222": "物理层接口特性",
    }


@pytest.mark.parametrize(
    "session",
    [
        _session("11111111-1111-1111-1111-111111111111", "还没命名", auto=True),
        _session("11111111-1111-1111-1111-111111111111", SESSION_PLACEHOLDER_TITLE, auto=False),
        _session("11111111-1111-1111-1111-111111111111", "2026-11-09 15:10:50", auto=False),
        _session("11111111-1111-1111-1111-111111111111", "   ", auto=False),
    ],
)
def test_parse_session_names_skips_unsettled_or_placeholder(session: dict) -> None:
    assert parse_session_names(_payload(session)) == {}


@pytest.mark.parametrize("payload", [None, {}, {"sessions": None}, {"sessions": [None, {}]}])
def test_parse_session_names_tolerates_bad_payload(payload: object) -> None:
    assert parse_session_names(payload) == {}
