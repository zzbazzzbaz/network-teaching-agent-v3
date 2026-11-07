import asyncio
import json
from pathlib import Path

import pytest
from agentscope.message import TextBlock, ToolResultState

from app.agent.tools.materials import MaterialsGrep, MaterialsLs, MaterialsRead


def _text(chunk) -> str:
    return "\n".join(
        block.text for block in chunk.content if isinstance(block, TextBlock)
    )


@pytest.fixture
def library_root(tmp_path: Path) -> Path:
    root = tmp_path / "library"
    book = root / "test-book"
    textbook = book / "textbook"
    chapter = textbook / "01-章"
    figures = book / "figures"
    hidden = book / ".index"
    for directory in (chapter, figures, hidden):
        directory.mkdir(parents=True)

    (book / "book.json").write_text(
        json.dumps({"title": "测试教材", "author": "作者"}, ensure_ascii=False),
        encoding="utf-8",
    )
    (textbook / "00-toc.md").write_text("# 目录\n", encoding="utf-8")
    (textbook / "many.md").write_text(
        "第一行\n第二行\n第三行\n第四行\n第五行\n第六行\n",
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
        "![图 1-1 示意图](../figures/fig-1-01.jpg)\n"
        "\n"
        "第三段。\n",
        encoding="utf-8",
    )
    (figures / "index.md").write_text("# 图注\n", encoding="utf-8")
    (figures / "fig-1-01.jpg").write_bytes(b"\xff\xd8\xff")
    (hidden / "pages.json").write_text("{}", encoding="utf-8")

    secret = tmp_path / "secret.md"
    secret.write_text("不应被读取\n", encoding="utf-8")
    (chapter / "escape.md").symlink_to(secret)
    return root


@pytest.mark.asyncio
async def test_ls_root_and_depth(library_root: Path) -> None:
    tool = MaterialsLs(root=library_root)

    root_text = _text(await tool.call(path="/"))
    assert "资料库 /" in root_text
    assert "test-book/" in root_text
    assert "测试教材" in root_text
    assert ".index" not in root_text

    depth_text = _text(await tool.call(path="/", depth=2))
    assert "book.json" in depth_text
    assert "textbook/" in depth_text
    assert "figures/" in depth_text

    textbook_text = _text(await tool.call(path="/test-book/textbook"))
    assert "01-章/" in textbook_text
    assert "00-toc.md  目录" in textbook_text

    chapter_text = _text(await tool.call(path="/test-book/textbook/01-章"))
    assert "1.1-小节.md" in chapter_text
    assert "第1章 1.1 小节标题" in chapter_text
    assert "第10-12页" in chapter_text

    figures_text = _text(await tool.call(path="/test-book/figures"))
    assert "index.md" in figures_text
    assert "fig-1-01.jpg" not in figures_text


@pytest.mark.asyncio
async def test_read_header_content_and_image(library_root: Path) -> None:
    tool = MaterialsRead(root=library_root)
    chunk = await tool.call(path="/test-book/textbook/01-章/1.1-小节.md")

    text = _text(chunk)
    assert chunk.state != ToolResultState.ERROR
    assert "【测试教材 | 第1章 1.1 小节标题 | 第10-12页】" in text
    assert "(第 1-7 行, 共 7 行)" in text
    assert "第一段包含 TCP 拥塞控制。" in text
    assert "图 1-1 示意图" in text
    assert "figures/fig-1-01.jpg" not in text
    assert "section:" not in text


@pytest.mark.asyncio
async def test_read_offset_and_truncation(library_root: Path) -> None:
    tool = MaterialsRead(root=library_root)
    text = _text(
        await tool.call(path="/test-book/textbook/many.md", offset=2, limit=3),
    )

    assert "(第 2-4 行, 共 6 行)" in text
    assert "第二行" in text
    assert "第四行" in text
    assert "第五行" not in text
    assert "[已截断: 用 offset=5 继续, 共 6 行]" in text


@pytest.mark.asyncio
async def test_read_basename_fallback(library_root: Path) -> None:
    tool = MaterialsRead(root=library_root)
    chunk = await tool.call(path="1.1-小节.md")

    assert chunk.state != ToolResultState.ERROR
    assert "第1章 1.1 小节标题" in _text(chunk)


@pytest.mark.asyncio
async def test_read_book_json(library_root: Path) -> None:
    tool = MaterialsRead(root=library_root)
    text = _text(await tool.call(path="/test-book/book.json"))

    assert '"title": "测试教材"' in text


@pytest.mark.asyncio
async def test_path_safety(library_root: Path, tmp_path: Path) -> None:
    tool = MaterialsRead(root=library_root)

    traversal = await tool.call(path="../secret.md")
    assert traversal.state == ToolResultState.ERROR

    absolute = await tool.call(path=str(tmp_path / "secret.md"))
    assert absolute.state == ToolResultState.ERROR

    symlink = await tool.call(path="/test-book/textbook/01-章/escape.md")
    assert symlink.state == ToolResultState.ERROR

    directory = await tool.call(path="/test-book/textbook")
    assert directory.state == ToolResultState.ERROR

    binary = await tool.call(path="/test-book/figures/fig-1-01.jpg")
    assert binary.state == ToolResultState.ERROR


@pytest.mark.asyncio
async def test_grep_hits_and_scope(library_root: Path) -> None:
    tool = MaterialsGrep(root=library_root)
    text = _text(
        await tool.call(
            query="TCP 拥塞控制",
            path="/test-book/textbook",
        ),
    )

    assert "[1] /test-book/textbook/01-章/1.1-小节.md" in text
    assert "【测试教材 | 第1章 1.1 小节标题 | 第10-12页】" in text
    assert "第一段包含 TCP 拥塞控制。" in text
    assert "第 " in text

    miss = _text(await tool.call(query="不存在的内容", path="/"))
    assert "未找到匹配内容" in miss

    scoped = _text(await tool.call(query="TCP", path="/test-book/figures"))
    assert "未找到匹配内容" in scoped


@pytest.mark.asyncio
async def test_grep_is_case_insensitive(library_root: Path) -> None:
    tool = MaterialsGrep(root=library_root)
    text = _text(await tool.call(query="tcp"))

    assert "/test-book/textbook/01-章/1.1-小节.md" in text


@pytest.mark.asyncio
async def test_concurrent_reads(library_root: Path) -> None:
    tool = MaterialsRead(root=library_root)
    path = "/test-book/textbook/01-章/1.1-小节.md"
    chunks = await asyncio.gather(*(tool.call(path=path) for _ in range(20)))

    assert all(chunk.state != ToolResultState.ERROR for chunk in chunks)
    assert len({_text(chunk) for chunk in chunks}) == 1
