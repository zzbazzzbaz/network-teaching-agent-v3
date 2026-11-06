from pathlib import Path

from agentscope.app.deps import get_current_user_id
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.agent.endpoints.memory import encode_entry_id, get_memory_dir, router

USER_ID = "32487b0e-4238-4008-8012-469091385e86"


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _client(tmp_path: Path) -> TestClient:
    root = tmp_path / USER_ID
    _write(
        root / "daily/2026-11-04/foo.md",
        "---\nname: Foo\ndescription: first card\n---\n\nfoo body\n",
    )
    _write(
        root / "daily/2026-11-05/bar.md",
        "---\nname: Bar\ndescription: second card\n---\n\nbar body\n",
    )

    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user_id] = lambda: USER_ID
    app.dependency_overrides[get_memory_dir] = lambda: tmp_path
    return TestClient(app)


def test_list_memory_entries(tmp_path: Path) -> None:
    response = _client(tmp_path).get("/memory/entries", params={"limit": 1})

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 2
    assert payload["has_more"] is True
    assert payload["items"][0]["title"] == "Bar"


def test_list_memory_entries_by_date_and_session(tmp_path: Path) -> None:
    client = _client(tmp_path)
    _write(
        tmp_path / USER_ID / "daily/2026-11-04/foo.md",
        "---\nname: Foo\nsession_id: 35126f44665c4ed888f33edab4710bf3\n---\n\nfoo body\n",
    )
    response = client.get(
        "/memory/entries",
        params={"date": "2026-11-04", "session_id": "35126f44-665c-4ed8-88f3-3edab4710bf3"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert [item["title"] for item in payload["items"]] == ["Foo"]
    assert payload["items"][0]["session_id"] == "35126f44-665c-4ed8-88f3-3edab4710bf3"


def test_read_memory_entry(tmp_path: Path) -> None:
    entry_id = encode_entry_id("daily/2026-11-04/foo.md")
    response = _client(tmp_path).get(f"/memory/entries/{entry_id}")

    assert response.status_code == 200
    payload = response.json()
    assert payload["title"] == "Foo"
    assert payload["content"] == "foo body"


def test_read_memory_entry_rejects_invalid_id(tmp_path: Path) -> None:
    response = _client(tmp_path).get(f"/memory/entries/{encode_entry_id('../etc/passwd')}")

    assert response.status_code == 400


def test_read_memory_entry_returns_404(tmp_path: Path) -> None:
    response = _client(tmp_path).get(
        f"/memory/entries/{encode_entry_id('daily/2026-11-04/missing.md')}"
    )

    assert response.status_code == 404


def test_invalid_user_id(tmp_path: Path) -> None:
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user_id] = lambda: "../other"
    app.dependency_overrides[get_memory_dir] = lambda: tmp_path
    response = TestClient(app).get("/memory/entries")

    assert response.status_code == 400
