from pathlib import Path

from scripts.textbook_kb import (
    build_docs,
    chapter_of,
    section_label,
    slugify,
    split_paragraphs,
)


def test_chapter_of() -> None:
    assert chapter_of("5.5") == "第5章"
    assert chapter_of("5-summary") == "第5章"
    assert chapter_of("A") == "附录A"


def test_section_label() -> None:
    assert section_label("5.5", "TCP报文段的首部格式") == "第5章 5.5 TCP报文段的首部格式"
    assert section_label("5-summary", "本章的重要概念") == "第5章 本章的重要概念"
    assert section_label("5-exercises", "习题") == "第5章 习题"
    assert section_label("A", "部分习题的解答") == "附录A 部分习题的解答"


def test_slugify() -> None:
    assert slugify("TCP 报文段/首部:格式") == "TCP报文段首部格式"
    assert len(slugify("长" * 100)) == 40


def test_split_paragraphs_adds_overlap() -> None:
    text = "\n\n".join(["一" * 600, "二" * 600, "三" * 600])
    pieces = split_paragraphs(text, max_chars=800, overlap=50)
    assert len(pieces) == 3
    assert all(len(piece) <= 900 for piece in pieces)
    assert pieces[1].startswith("一" * 50)
    assert pieces[2].startswith("二" * 50)


def test_split_paragraphs_without_overlap_keeps_paragraphs() -> None:
    text = "\n\n".join(["一" * 600, "二" * 600])
    pieces = split_paragraphs(text, max_chars=800, overlap=0)
    assert pieces == ["一" * 600, "二" * 600]


def test_split_paragraphs_hard_splits_long_paragraph() -> None:
    pieces = split_paragraphs("字" * 3000, max_chars=1000, overlap=0)
    assert len(pieces) == 3
    assert all(len(piece) == 1000 for piece in pieces)


def test_split_paragraphs_keeps_lines_for_long_text() -> None:
    text = "\n".join(f"- 第{index}章 概述(教材 {index})" for index in range(1, 200))
    pieces = split_paragraphs(text, max_chars=200, overlap=0)
    assert len(pieces) > 1
    for piece in pieces:
        for line in piece.splitlines():
            assert line.startswith("- 第")
            assert line.endswith(")")


def test_build_docs_rewrites_images_and_pages(tmp_path: Path) -> None:
    source = tmp_path / "05-运输层"
    source.mkdir()
    (source / "5.5-TCP报文段的首部格式.md").write_text(
        "---\n"
        'section: "5.5"\n'
        'title: "TCP报文段的首部格式"\n'
        "book_pages: [225, 229]\n"
        "---\n\n"
        "# 5.5 TCP报文段的首部格式\n\n"
        "第一段。\n\n"
        "![图 5-13 TCP 报文段的首部格式 \\[RFC 6691\\]](../../figures/05-运输层/fig-5-13.jpg)\n\n"
        "第二段。\n",
        encoding="utf-8",
    )

    docs = build_docs(tmp_path)

    assert len(docs) == 1
    doc = docs[0]
    assert doc.name == "5.5-TCP报文段的首部格式-p225-229-01.md"
    assert doc.text.startswith("【第5章 5.5 TCP报文段的首部格式 | 教材第225-229页】")
    assert "fig-5-13" not in doc.text
    assert "图 5-13 TCP 报文段的首部格式" in doc.text
    assert "RFC 6691" in doc.text
    assert "第一段" in doc.text
    assert "第二段" in doc.text
    assert not doc.text.startswith("#")
    assert doc.text.endswith("\n")


def test_build_docs_toc(tmp_path: Path) -> None:
    (tmp_path / "00-toc.md").write_text("# 目录\n\n- 第1章 概述\n", encoding="utf-8")

    docs = build_docs(tmp_path)

    assert len(docs) == 1
    assert docs[0].name == "00-目录-01.md"
    assert docs[0].text.startswith("【教材目录】")
    assert "第1章 概述" in docs[0].text
