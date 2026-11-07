"""把计算机网络教材预处理后导入 AgentScope 知识库。

用法:
    python -m scripts.textbook_kb create
    python -m scripts.textbook_kb prepare --out-dir build/textbook_kb
    python -m scripts.textbook_kb upload --kb-id <id> --wait
    python -m scripts.textbook_kb wait --kb-id <id>
    python -m scripts.textbook_kb verify --kb-id <id>

预处理规则: 每个小节按段落切成小块, 每块带小节和教材页码, 图片直接丢弃。
每个小块作为一个文档上传, 文档名和正文第一行都带页码, 便于检索后引用。
"""

import argparse
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import frontmatter
import httpx

from app.agent.runtime.models import EMBEDDING_DIMENSIONS
from app.shared.config import get_settings
from app.shared.constants import AGENT_CREDENTIAL_ID, SYSTEM_USER_ID

DEFAULT_TEXTBOOK_DIR = (
    Path(__file__).resolve().parent.parent
    / "app"
    / "agent"
    / "skills"
    / "computer-networks-textbook"
    / "textbook"
)
HEADER_TEMPLATE = "【{label} | 教材第{start}-{end}页】"
IMAGE_PATTERN = re.compile(r"!\[([^\n]*?)\]\([^)]*\)")
HTML_COMMENT_PATTERN = re.compile(r"<!--.*?-->", re.DOTALL)
H1_PATTERN = re.compile(r"^# .*\n+")
BLANK_LINES_PATTERN = re.compile(r"\n{3,}")
TITLE_SANITIZE_PATTERN = re.compile(r'[\\/:*?"<>|\s]+')
PAGE_PATTERN = re.compile(r"p(\d+)-(\d+)")
SENTENCE_END = "\u3002\uff01\uff1f\uff1b!?;"
SENTENCE_PATTERN = re.compile(rf"[^{SENTENCE_END}]+[{SENTENCE_END}]?")

TERMINAL_STATUSES = {"ready", "error"}

DEFAULT_QUERIES = (
    "TCP 三次握手的过程",
    "TCP 四次挥手的过程",
    "TCP 拥塞控制 慢开始 拥塞避免",
    "CSMA/CD 的工作原理",
    "交换机 自学习 转发表",
    "NAT 网络地址转换",
    "子网划分 CIDR",
    "HTTP 请求报文 方法",
    "DNS 域名解析过程",
    "DHCP 工作过程",
    "IP 数据报 首部格式",
    "UDP 首部格式",
)


@dataclass(frozen=True, slots=True)
class Doc:
    name: str
    text: str


def chapter_of(section: str) -> str:
    """把小节号转换为章节标签。"""
    if section[0].isdigit():
        return f"第{section.split('-')[0].split('.')[0]}章"
    return f"附录{section}"


def section_label(section: str, title: str) -> str:
    """生成正文首行的章节标签。"""
    chapter = chapter_of(section)
    if section.endswith("-summary") or section.endswith("-exercises"):
        return f"{chapter} {title}"
    if section[0].isdigit():
        return f"{chapter} {section} {title}"
    return f"{chapter} {title}"


def slugify(text: str) -> str:
    """去掉文件名中不适合出现的字符。"""
    return TITLE_SANITIZE_PATTERN.sub("", text)[:40]


def _split_long(paragraph: str, max_chars: int) -> list[str]:
    lines = paragraph.splitlines() if "\n" in paragraph else [paragraph]
    units: list[str] = []
    for line in lines:
        if len(line) <= max_chars:
            units.append(line)
            continue
        units.extend(SENTENCE_PATTERN.findall(line))

    pieces: list[str] = []
    buffer = ""
    for unit in units:
        if len(unit) > max_chars:
            if buffer:
                pieces.append(buffer)
                buffer = ""
            pieces.extend(
                unit[offset : offset + max_chars] for offset in range(0, len(unit), max_chars)
            )
            continue
        if buffer and len(buffer) + len(unit) + 1 > max_chars:
            pieces.append(buffer)
            buffer = unit
        else:
            buffer = f"{buffer}\n{unit}" if buffer else unit
    if buffer:
        pieces.append(buffer)
    return pieces


def split_paragraphs(
    text: str,
    max_chars: int = 1400,
    overlap: int = 150,
) -> list[str]:
    """按段落切成带少量重叠的小块。"""
    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
    pieces: list[str] = []
    buffer = ""
    for paragraph in paragraphs:
        if len(paragraph) > max_chars:
            if buffer:
                pieces.append(buffer)
                buffer = ""
            pieces.extend(_split_long(paragraph, max_chars))
            continue
        if buffer and len(buffer) + len(paragraph) + 2 > max_chars:
            pieces.append(buffer)
            buffer = paragraph
        else:
            buffer = f"{buffer}\n\n{paragraph}" if buffer else paragraph
    if buffer:
        pieces.append(buffer)
    if overlap <= 0 or len(pieces) < 2:
        return pieces

    overlapped = [pieces[0]]
    for piece in pieces[1:]:
        tail = overlapped[-1][-overlap:].lstrip(
            "\n\r\t \u3002\uff01\uff1f\uff1b!?;,\u3001",
        )
        overlapped.append(f"{tail}\n\n{piece}" if tail else piece)
    return overlapped


def strip_images(text: str) -> str:
    """把图片替换成图注文字, 丢掉图片地址。"""
    return IMAGE_PATTERN.sub(lambda match: match.group(1), text)


def clean_body(text: str) -> str:
    """去掉正文里的图片地址、HTML 注释和重复的一级标题。"""
    text = strip_images(text)
    text = HTML_COMMENT_PATTERN.sub("", text)
    text = text.lstrip()
    text = H1_PATTERN.sub("", text, count=1)
    text = BLANK_LINES_PATTERN.sub("\n\n", text)
    return text.strip()


def build_docs(root: Path) -> list[Doc]:
    """读取教材目录, 生成待上传的文档列表。"""
    docs: list[Doc] = []
    for path in sorted(root.rglob("*.md")):
        post = frontmatter.loads(path.read_text(encoding="utf-8"))
        meta = post.metadata or {}
        if meta:
            section = str(meta["section"])
            title = str(meta["title"])
            pages = meta["book_pages"]
            if not isinstance(pages, (list, tuple)) or len(pages) != 2:
                raise ValueError(f"invalid book_pages in {path}")
            start, end = int(pages[0]), int(pages[1])
            header = HEADER_TEMPLATE.format(
                label=section_label(section, title),
                start=start,
                end=end,
            )
            stem = f"{slugify(section)}-{slugify(title)}-p{start}-{end}"
        elif path.name == "00-toc.md":
            header = "【教材目录】"
            stem = "00-目录"
        else:
            header = f"【{path.parent.name} {path.stem}】"
            stem = f"00-{slugify(path.stem)}"

        body = clean_body(post.content)
        for index, piece in enumerate(split_paragraphs(body), start=1):
            docs.append(
                Doc(
                    name=f"{stem}-{index:02d}.md",
                    text=f"{header}\n\n{piece}\n",
                )
            )
    return docs


def load_queries(path: Path | None, inline: list[str] | None) -> list[str]:
    """合并查询文件、命令行查询和内置样例。"""
    queries: list[str] = []
    if path is not None:
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                queries.append(line)
    if inline:
        queries.extend(query.strip() for query in inline if query.strip())
    return queries or list(DEFAULT_QUERIES)


def _base_url(args: argparse.Namespace) -> str:
    return args.base_url or get_settings().agent_base_url


def _api_client(base_url: str) -> httpx.Client:
    return httpx.Client(
        base_url=base_url.rstrip("/"),
        headers={"X-User-ID": SYSTEM_USER_ID},
        timeout=httpx.Timeout(connect=5.0, read=60.0, write=60.0, pool=5.0),
    )


def _list_documents(client: httpx.Client, kb_id: str) -> list[dict]:
    documents: list[dict] = []
    page = 1
    while True:
        response = client.get(
            f"/knowledge_bases/{kb_id}/documents",
            params={"page": page, "page_size": 128},
        )
        response.raise_for_status()
        payload = response.json()
        documents.extend(payload["documents"])
        if len(documents) >= payload["total"] or not payload["documents"]:
            return documents
        page += 1


def _wait_for_documents(
    client: httpx.Client,
    kb_id: str,
    interval: int,
    timeout: int,
) -> int:
    deadline = time.monotonic() + timeout
    while True:
        documents = _list_documents(client, kb_id)
        if not documents:
            print("[wait] no documents")
            return 1
        ready = sum(1 for document in documents if document["status"] == "ready")
        errors = [document for document in documents if document["status"] == "error"]
        pending = [
            document for document in documents if document["status"] not in TERMINAL_STATUSES
        ]
        print(
            f"[wait] total={len(documents)} ready={ready} "
            f"pending={len(pending)} error={len(errors)}",
        )
        if not pending:
            for document in errors:
                print(f"[error] {document['filename']}: {document.get('error') or 'unknown'}")
            return 1 if errors else 0
        if time.monotonic() >= deadline:
            print(f"[timeout] pending={len(pending)}")
            return 2
        time.sleep(interval)


def command_create(args: argparse.Namespace) -> int:
    settings = get_settings()
    payload = {
        "name": args.name,
        "description": args.description,
        "embedding_model_config": {
            "type": args.credential_type,
            "credential_id": args.credential_id or AGENT_CREDENTIAL_ID,
            "model": args.embedding_model or settings.llm.embedding_model,
            "dimensions": args.dimensions or EMBEDDING_DIMENSIONS,
        },
        "chunker_config": {
            "type": "approx_token",
            "parameters": {
                "chunk_size": args.chunk_size,
                "overlap": args.overlap,
            },
        },
    }
    with _api_client(_base_url(args)) as client:
        response = client.post("/knowledge_bases/", json=payload)
        response.raise_for_status()
        knowledge_base_id = response.json()["knowledge_base_id"]
    print(f"[created] knowledge_base_id={knowledge_base_id}")
    print(f"TEXTBOOK_KB_ID={knowledge_base_id}")
    return 0


def command_prepare(args: argparse.Namespace) -> int:
    docs = build_docs(Path(args.textbook_dir))
    if args.limit is not None:
        docs = docs[: args.limit]
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    for doc in docs:
        (out_dir / doc.name).write_text(doc.text, encoding="utf-8")
    print(f"[done] documents={len(docs)} out_dir={out_dir}")
    return 0


def command_upload(args: argparse.Namespace) -> int:
    docs = build_docs(Path(args.textbook_dir))
    if args.limit is not None:
        docs = docs[: args.limit]
    if not docs:
        print("[error] no documents")
        return 1
    print(f"[prepare] documents={len(docs)}")
    if args.dry_run:
        for doc in docs[:3]:
            print(f"[sample] {doc.name}")
        return 0

    with _api_client(_base_url(args)) as client:
        if args.replace:
            existing = _list_documents(client, args.kb_id)
            for document in existing:
                response = client.delete(
                    f"/knowledge_bases/{args.kb_id}/documents/{document['id']}",
                )
                response.raise_for_status()
            print(f"[replace] deleted={len(existing)}")

        existing_names: set[str] = set()
        if args.skip_existing:
            existing_names = {
                document["filename"] for document in _list_documents(client, args.kb_id)
            }

        uploaded = 0
        for doc in docs:
            if doc.name in existing_names:
                continue
            response = client.post(
                f"/knowledge_bases/{args.kb_id}/documents",
                files={
                    "file": (
                        doc.name,
                        doc.text.encode("utf-8"),
                        "text/markdown",
                    ),
                },
            )
            if response.status_code >= 400:
                print(f"[error] {doc.name}: {response.status_code} {response.text[:300]}")
                return 1
            uploaded += 1
            if uploaded % 25 == 0:
                print(f"[upload] {uploaded}/{len(docs)}")

        print(f"[done] uploaded={uploaded} total={len(docs)}")
        if args.wait:
            return _wait_for_documents(
                client,
                args.kb_id,
                interval=args.interval,
                timeout=args.timeout,
            )
    return 0


def command_wait(args: argparse.Namespace) -> int:
    with _api_client(_base_url(args)) as client:
        return _wait_for_documents(
            client,
            args.kb_id,
            interval=args.interval,
            timeout=args.timeout,
        )


def command_verify(args: argparse.Namespace) -> int:
    queries = load_queries(Path(args.queries) if args.queries else None, args.query)
    misses = 0
    no_page = 0
    with _api_client(_base_url(args)) as client:
        for index, query in enumerate(queries, start=1):
            response = client.post(
                f"/knowledge_bases/{args.kb_id}/search",
                json={"query": query, "top_k": args.top_k},
            )
            response.raise_for_status()
            results = response.json()["results"]
            print(f"[{index}] {query}")
            if not results:
                misses += 1
                print("  [miss]")
                continue
            for hit in results:
                chunk = hit["chunk"]
                content = chunk["content"]
                text = content.get("text", "") if isinstance(content, dict) else ""
                source = chunk["source"]
                flag = "" if PAGE_PATTERN.search(source) or "教材第" in text else " [no-page]"
                if flag:
                    no_page += 1
                print(f"  {hit['score']:.3f}  {source}{flag}")
                print(f"    {text[:80].replace(chr(10), ' ')}")
    print(f"[summary] queries={len(queries)} misses={misses} no_page={no_page}")
    return 1 if misses else 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="textbook-kb",
        description="把计算机网络教材预处理后导入 AgentScope 知识库",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument(
        "--base-url",
        default=None,
        help="agent 服务地址, 默认读 AGENT_BASE_URL",
    )

    create = subparsers.add_parser("create", parents=[common], help="创建 system 知识库")
    create.add_argument("--name", default="计算机网络教材(谢希仁 第8版)")
    create.add_argument(
        "--description",
        default="教材原文; source 文件名形如 5.5-...-p225-229-03.md, p 后为教材页码范围",
    )
    create.add_argument("--credential-type", default="dashscope_credential")
    create.add_argument("--credential-id", default=None)
    create.add_argument("--embedding-model", default=None)
    create.add_argument("--dimensions", type=int, default=None)
    create.add_argument("--chunk-size", type=int, default=2048)
    create.add_argument("--overlap", type=int, default=0)
    create.set_defaults(handler=command_create)

    prepare = subparsers.add_parser("prepare", help="只生成预处理文件, 供 curl 上传")
    prepare.add_argument("--textbook-dir", default=str(DEFAULT_TEXTBOOK_DIR))
    prepare.add_argument("--out-dir", required=True)
    prepare.add_argument("--limit", type=int, default=None)
    prepare.set_defaults(handler=command_prepare)

    upload = subparsers.add_parser("upload", parents=[common], help="预处理并上传教材")
    upload.add_argument("--kb-id", required=True)
    upload.add_argument("--textbook-dir", default=str(DEFAULT_TEXTBOOK_DIR))
    upload.add_argument("--replace", action="store_true", help="先删除 KB 内所有文档")
    upload.add_argument("--skip-existing", action="store_true", help="跳过同名文档")
    upload.add_argument("--limit", type=int, default=None)
    upload.add_argument("--dry-run", action="store_true")
    upload.add_argument("--wait", action="store_true")
    upload.add_argument("--interval", type=int, default=3)
    upload.add_argument("--timeout", type=int, default=900)
    upload.set_defaults(handler=command_upload)

    wait = subparsers.add_parser("wait", parents=[common], help="等待索引完成")
    wait.add_argument("--kb-id", required=True)
    wait.add_argument("--interval", type=int, default=3)
    wait.add_argument("--timeout", type=int, default=900)
    wait.set_defaults(handler=command_wait)

    verify = subparsers.add_parser("verify", parents=[common], help="抽查检索结果")
    verify.add_argument("--kb-id", required=True)
    verify.add_argument("--queries", default=None, help="每行一个查询的文本文件")
    verify.add_argument("--query", action="append", default=None, help="命令行查询, 可重复")
    verify.add_argument("--top-k", type=int, default=5)
    verify.set_defaults(handler=command_verify)

    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.handler(args)
    except httpx.HTTPError as exc:
        print(f"[error] {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
