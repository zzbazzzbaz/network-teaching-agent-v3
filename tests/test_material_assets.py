import uuid

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


def test_material_storage_key() -> None:
    file = _file(session_id=None)
    assert file.storage_key == f"materials/{file.id}.jpg"
    assert file.thumb_key == f"materials/{file.id}.jpg.thumb.jpg"


def test_session_attachment_storage_key_unchanged() -> None:
    session_id = uuid.uuid4()
    file = _file(session_id=session_id, name="photo.PNG")
    assert file.storage_key == f"sessions/{session_id}/{file.id}.png"


def test_raw_path_works_for_material_image() -> None:
    file = _file(session_id=None)
    token = file_service.raw_token(file.id)

    assert file_service.verify_raw_token(file.id, token)
    assert file_service.raw_path(file) == f"/api/files/{file.id}/raw?token={token}"


def test_material_markdown_uses_relative_raw_path() -> None:
    file = _file(session_id=None)
    markdown = file_service.material_markdown(file)

    assert markdown.startswith("![fig-05-23.jpg](/api/files/")
    assert token_is_embedded(markdown, file.id)


def token_is_embedded(markdown: str, file_id: uuid.UUID) -> bool:
    token = file_service.raw_token(file_id)
    return f"/api/files/{file_id}/raw?token={token}" in markdown
