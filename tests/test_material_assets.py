import uuid

import pytest

from app.api.repositories.models import File
from app.api.services import file_service


def _file(*, session_id: uuid.UUID | None, name: str = "fig-05-23.jpg") -> File:
    return File(
        session_id=session_id,
        user_id=uuid.uuid4(),
        original_name=name,
        content_type="image/jpeg",
        size_bytes=10,
    )


def _stub_settings(monkeypatch: pytest.MonkeyPatch, base_url: str) -> None:
    class _Cos:
        public_base_url = base_url

    class _Settings:
        cos = _Cos()

    monkeypatch.setattr(file_service, "get_settings", lambda: _Settings())


def test_material_storage_key() -> None:
    file = _file(session_id=None)
    assert file.storage_key == f"public/materials/{file.id}.jpg"


def test_session_attachment_storage_key() -> None:
    session_id = uuid.uuid4()
    file = _file(session_id=session_id, name="photo.PNG")
    assert file.storage_key == f"public/sessions/{session_id}/{file.id}.png"


def test_material_public_url(monkeypatch: pytest.MonkeyPatch) -> None:
    _stub_settings(monkeypatch, "https://cos.example.com/")
    file = _file(session_id=None)

    assert (
        file_service.public_url(file) == f"https://cos.example.com/public/materials/{file.id}.jpg"
    )


def test_session_public_url(monkeypatch: pytest.MonkeyPatch) -> None:
    _stub_settings(monkeypatch, "https://cos.example.com")
    session_id = uuid.uuid4()
    file = _file(session_id=session_id, name="photo.PNG")

    assert (
        file_service.public_url(file)
        == f"https://cos.example.com/public/sessions/{session_id}/{file.id}.png"
    )


def test_material_markdown_uses_public_url(monkeypatch: pytest.MonkeyPatch) -> None:
    _stub_settings(monkeypatch, "https://cos.example.com")
    file = _file(session_id=None)

    markdown = file_service.material_markdown(file)

    assert markdown == (f"![fig-05-23.jpg](https://cos.example.com/public/materials/{file.id}.jpg)")
