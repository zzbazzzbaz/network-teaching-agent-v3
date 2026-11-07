from pathlib import Path

import pytest
from agentscope.message import TextBlock, ToolResultState

from app.agent.tools.materials import MaterialsGrep, MaterialsLs, MaterialsRead


def _text(chunk) -> str:
    return "\n".join(
        block.text for block in chunk.content if isinstance(block, TextBlock)
    )


@pytest.fixture
def materials_root(tmp_path: Path) -> Path:
    root = tmp_path / "materials"
    book = root / "test-book"
    chapter = book / "01-章"
    chapter.mkdir(parents=True)
    (book / "00-toc.md").write_text(
        "# 目录\n\n- 1.1 小节标题(教材 10)\n",
        encoding="utf-8",
    )
    (chapter / "1.1-小节.md").write_text(
        "---\n"
        'section: "1.1"\n'
        'title: "小节标题"\n'
        "book_pages: [10, 12]\n"
        "---\n"
        "\n"
        "# 1.1 小节标题\n"
        "\n"
        "第一段包含 TCP 拥塞控制。\n"
        "\n"
        "第二段。\n",
        encoding="utf-8",
    )
    (chapter / "many.md").write_text(
        "第一行\n第二行\n第三行\n第四行\n",
        encoding="utf-8",
    )
    hidden = book / ".hidden"
    hidden.mkdir()
    (hidden / "secret.md").write_text("隐藏内容\n", encoding="utf-8")
    (book / "image.png").write_bytes(b"\x89PNG\r\n")
    secret = tmp_path / "secret.md"
    secret.write_text("不应读取\n", encoding="utf-8")
    (chapter / "escape.md").symlink_to(secret)
    return root


@pytest.mark.asyncio
async def test_ls(materials_root: Path) -> None:
    tool = MaterialsLs(root=materials_root)

    root_text = _text(await tool.call(path="/"))
    assert "test-book/" in root_text
    assert ".hidden" not in root_text

    book_text = _text(await tool.call(path="/test-book"))
    assert "00-toc.md" in book_text
    assert "01-章/" in book_text
    assert "image.png" in book_text

    chapter_text = _text(await tool.call(path="/test-book/01-章"))
    assert "1.1-小节.md" in chapter_text
    assert "many.md" in chapter_text


@pytest.mark.asyncio
async def test_read_strips_frontmatter(materials_root: Path) -> None:
    tool = MaterialsRead(root=materials_root)
    text = _text(await tool.call(path="/test-book/01-章/1.1-小节.md"))

    assert "section:" not in text
    assert "book_pages" not in text
    assert "# 1.1 小节标题" in text
    assert "TCP 拥塞控制" in text


@pytest.mark.asyncio
async def test_read_offset_and_limit(materials_root: Path) -> None:
    tool = MaterialsRead(root=materials_root)
    text = _text(
        await tool.call(path="/test-book/01-章/many.md", offset=2, limit=2),
    )

    assert text == "第二行\n第三行"


@pytest.mark.asyncio
async def test_path_safety(materials_root: Path, tmp_path: Path) -> None:
    tool = MaterialsRead(root=materials_root)

    assert (await tool.call(path="../secret.md")).state == ToolResultState.ERROR
    assert (await tool.call(path="/../secret.md")).state == ToolResultState.ERROR
    assert (
        await tool.call(path=str(tmp_path / "secret.md"))
    ).state == ToolResultState.ERROR
    assert (
        await tool.call(path="/test-book/01-章/escape.md")
    ).state == ToolResultState.ERROR
    assert (await tool.call(path="/test-book/image.png")).state == ToolResultState.ERROR
    assert (await tool.call(path="/test-book/01-章")).state == ToolResultState.ERROR


@pytest.mark.asyncio
async def test_grep(materials_root: Path) -> None:
    tool = MaterialsGrep(root=materials_root)

    text = _text(await tool.call(query="tcp"))
    assert "/test-book/01-章/1.1-小节.md:3: 第一段包含 TCP 拥塞控制。" in text

    scoped = _text(
        await tool.call(query="第二段", path="/test-book/01-章"),
    )
    assert "/test-book/01-章/1.1-小节.md:5: 第二段。" in scoped

    limited = _text(
        await tool.call(query="行", path="/test-book/01-章/many.md", limit=2),
    )
    assert len(limited.splitlines()) == 2

    direct = _text(
        await tool.call(query="第三行", path="/test-book/01-章/many.md"),
    )
    assert "/test-book/01-章/many.md:3: 第三行" in direct

    assert "未找到" in _text(await tool.call(query="隐藏内容"))
    assert "未找到" in _text(await tool.call(query="不应读取"))


@pytest.mark.asyncio
async def test_missing_paths(materials_root: Path) -> None:
    assert (
        await MaterialsLs(root=materials_root).call(path="/missing")
    ).state == ToolResultState.ERROR
    assert (
        await MaterialsRead(root=materials_root).call(path="/missing.md")
    ).state == ToolResultState.ERROR
    assert (
        await MaterialsGrep(root=materials_root).call(query="x", path="/missing")
    ).state == ToolResultState.ERROR
