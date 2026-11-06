from pathlib import Path

import pytest

from app.agent.api.memory import (
    InvalidMemoryEntryId,
    MemoryEntryNotFound,
    decode_entry_id,
    encode_entry_id,
    get_entry,
    list_entries,
)


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _vault(tmp_path: Path) -> Path:
    root = tmp_path / "user"
    _write(
        root / "daily/2026-11-04/foo.md",
        "---\n"
        "name: Foo\n"
        "description: first card\n"
        "session_id: 35126f44665c4ed888f33edab4710bf3\n"
        "---\n\n"
        "# Foo heading\n\n"
        "foo body\n",
    )
    _write(root / "daily/2026-11-04.md", "index file")
    _write(
        root / "daily/2026-11-05/bar.md",
        "---\nname: Bar\ndescription: second card\n---\n\nbar body\n",
    )
    _write(
        root / "digest/topics/tcp.md",
        "---\nname: TCP\ndescription: digest card\n---\n\ndigest body\n",
    )
    return root


def test_list_daily_entries_excludes_index_and_sorts_desc(tmp_path: Path) -> None:
    page = list_entries(_vault(tmp_path), kind="daily", limit=20, offset=0)

    assert [item.title for item in page.items] == ["Bar", "Foo"]
    assert page.total == 2
    assert page.truncated is False
    assert all(item.content is None for item in page.items)


def test_list_daily_entries_filters_by_date(tmp_path: Path) -> None:
    page = list_entries(
        _vault(tmp_path),
        kind="daily",
        limit=20,
        offset=0,
        date="2026-11-04",
    )

    assert [item.title for item in page.items] == ["Foo"]


def test_list_daily_entries_filters_by_session(tmp_path: Path) -> None:
    page = list_entries(
        _vault(tmp_path),
        kind="daily",
        limit=20,
        offset=0,
        session_id="35126f44-665c-4ed8-88f3-3edab4710bf3",
    )

    assert [item.title for item in page.items] == ["Foo"]
    assert page.items[0].session_id == "35126f44-665c-4ed8-88f3-3edab4710bf3"


def test_list_digest_entries(tmp_path: Path) -> None:
    page = list_entries(_vault(tmp_path), kind="digest", limit=20, offset=0)

    assert [item.title for item in page.items] == ["TCP"]
    assert page.items[0].date is None


def test_list_entries_paginates(tmp_path: Path) -> None:
    page = list_entries(_vault(tmp_path), kind="daily", limit=1, offset=1)

    assert page.total == 2
    assert [item.title for item in page.items] == ["Foo"]


def test_list_entries_returns_empty_for_missing_user(tmp_path: Path) -> None:
    page = list_entries(
        tmp_path / "missing",
        kind="daily",
        limit=20,
        offset=0,
    )

    assert page.items == []
    assert page.total == 0
    assert page.truncated is False


def test_get_entry_returns_markdown_body(tmp_path: Path) -> None:
    root = _vault(tmp_path)
    page = list_entries(root, kind="daily", limit=20, offset=0)
    entry = get_entry(root, page.items[0].entry_id)

    assert entry.title == "Bar"
    assert entry.content == "bar body"
    assert entry.content_truncated is False


def test_get_entry_missing_raises(tmp_path: Path) -> None:
    with pytest.raises(MemoryEntryNotFound):
        get_entry(_vault(tmp_path), encode_entry_id("daily/2026-11-04/missing.md"))


def test_get_entry_rejects_symlink_escape(tmp_path: Path) -> None:
    root = tmp_path / "user"
    target = root / "daily/2026-11-04/link.md"
    target.parent.mkdir(parents=True)
    outside = tmp_path / "outside.md"
    outside.write_text("secret", encoding="utf-8")
    target.symlink_to(outside)

    with pytest.raises(InvalidMemoryEntryId):
        get_entry(root, encode_entry_id("daily/2026-11-04/link.md"))


@pytest.mark.parametrize(
    "relative",
    [
        "../outside.md",
        "daily/2026-11-04.md",
        "daily/2026-11-04/../x.md",
        "metadata/foo.md",
        "daily/2026-11-04/foo.txt",
        "/etc/passwd",
    ],
)
def test_decode_rejects_invalid_paths(relative: str) -> None:
    with pytest.raises(InvalidMemoryEntryId):
        decode_entry_id(encode_entry_id(relative))


def test_decode_rejects_malformed_base64() -> None:
    with pytest.raises(InvalidMemoryEntryId):
        decode_entry_id("not base64")


def test_frontmatter_fallback_uses_filename_and_first_line(tmp_path: Path) -> None:
    root = tmp_path / "user"
    _write(root / "daily/2026-11-04/plain.md", "\nplain summary\n")

    page = list_entries(root, kind="daily", limit=20, offset=0)

    assert page.items[0].title == "plain"
    assert page.items[0].summary == "plain summary"
