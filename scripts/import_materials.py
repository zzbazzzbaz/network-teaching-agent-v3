"""把教材与题库源目录导入数据库内容树。

用法:
    uv run python -m scripts.import_materials --dry-run
    uv run python -m scripts.import_materials
    uv run python -m scripts.import_materials --uploader-id <admin_uuid>
"""

import argparse
import asyncio
import mimetypes
import re
import sys
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import col, select

from app.api.core.database import close_db, create_db_and_tables, session_scope
from app.api.infra import cos
from app.api.repositories import material_repositories
from app.api.repositories.models import (
    File,
    FileStatus,
    MaterialCollection,
    MaterialNode,
    User,
    UserRole,
    UserStatus,
)
from app.shared import storage_keys
from app.shared.config import get_settings
from app.shared.enums import MaterialCollectionKind

DEFAULT_SOURCE = Path("app/agent/resource/materials")

_FRONTMATTER = re.compile(r"\A---\n.*?\n---\n", re.DOTALL)
_IMAGE = re.compile(r"!\[([^\]]*)\]\(([^)\s]+)(?:\s+[\"'][^\"']*[\"'])?\)")
_DOCUMENT_SUFFIXES = {".md", ".html", ".txt", ".json"}
_NON_MD_SUFFIXES = {".html", ".txt", ".json"}

@dataclass(frozen=True, slots=True)
class CollectionSpec:
    slug: str
    title: str
    kind: MaterialCollectionKind
    description: str
    sort_order: int


_COLLECTIONS = (
    CollectionSpec(
        slug="computer-networks-8e",
        title="计算机网络（第8版）",
        kind=MaterialCollectionKind.TEXTBOOK,
        description="谢希仁《计算机网络》（第8版）教材原文与图注。",
        sort_order=0,
    ),
    CollectionSpec(
        slug="exam-408",
        title="408 计算机网络题库",
        kind=MaterialCollectionKind.QUESTION_BANK,
        description="408 计算机网络选择题与综合题。",
        sort_order=1,
    ),
    CollectionSpec(
        slug=".templates",
        title="绘图模板",
        kind=MaterialCollectionKind.TEXTBOOK,
        description="Agent 绘图 skill 使用的 HTML 模板，不在学生端展示。",
        sort_order=99,
    ),
)


@dataclass(slots=True)
class Stats:
    folders: int = 0
    documents: int = 0
    images: int = 0
    uploaded: int = 0
    skipped: int = 0
    warnings: list[str] = field(default_factory=list)


@dataclass(slots=True)
class Context:
    session: AsyncSession | None
    uploader_id: uuid.UUID | None
    dry_run: bool
    source_root: Path
    stats: Stats
    cache: dict[uuid.UUID, File] = field(default_factory=dict)

    async def upsert_node(
        self,
        collection: MaterialCollection,
        parent: MaterialNode | None,
        name: str,
        content: str | None,
        sort_order: int,
    ) -> MaterialNode:
        if self.dry_run:
            return MaterialNode(
                collection_id=collection.id,
                parent_id=parent.id if parent else None,
                name=name,
                content=content,
                sort_order=sort_order,
            )
        session = self.session
        assert session is not None
        node = await material_repositories.find_sibling(
            session,
            collection_id=collection.id,
            parent_id=parent.id if parent else None,
            name=name,
        )
        if node is None:
            node = MaterialNode(
                collection_id=collection.id,
                parent_id=parent.id if parent else None,
                name=name,
                content=content,
                sort_order=sort_order,
            )
            await material_repositories.create_node(session, node)
        else:
            node.content = content
            node.sort_order = sort_order
            node.updated_at = datetime.now(UTC)
            session.add(node)
            await session.flush()
        return node


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="导入教材与题库内容树")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--uploader-id", type=uuid.UUID, default=None)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def _content_type(path: Path) -> str:
    return mimetypes.guess_type(path.name)[0] or "application/octet-stream"


def _file_id(*, collection_slug: str, document_path: str, image_path: str) -> uuid.UUID:
    return uuid.uuid5(
        uuid.NAMESPACE_URL,
        f"materials:{collection_slug}:{document_path}:{image_path}",
    )


async def _rewrite_images(
    ctx: Context,
    *,
    collection: MaterialCollection,
    document_path: str,
    markdown_path: Path,
    content: str,
) -> str:
    parts: list[str] = []
    cursor = 0
    for match in _IMAGE.finditer(content):
        alt, target = match.group(1), match.group(2)
        if target.startswith(("http://", "https://", "/", "data:")):
            continue
        resolved = (markdown_path.parent / target).resolve()
        if not resolved.is_relative_to(ctx.source_root):
            ctx.stats.warnings.append(f"越界图片: {markdown_path}: {target}")
            continue
        if not resolved.is_file():
            ctx.stats.warnings.append(f"图片不存在: {markdown_path}: {target}")
            continue
        relative = resolved.relative_to(ctx.source_root).as_posix()
        file_id = _file_id(
            collection_slug=collection.slug,
            document_path=document_path,
            image_path=relative,
        )
        key = storage_keys.material_key(file_id, resolved.name)
        base = get_settings().cos.public_base_url.rstrip("/")
        parts.append(content[cursor : match.start()])
        parts.append(f"![{alt}]({base}/{key})")
        cursor = match.end()
        ctx.stats.images += 1
        if ctx.dry_run:
            ctx.stats.uploaded += 1
            continue
        await _ensure_file(ctx, file=resolved, file_id=file_id)
    parts.append(content[cursor:])
    return "".join(parts)


async def _ensure_file(ctx: Context, *, file: Path, file_id: uuid.UUID) -> None:
    session = ctx.session
    uploader_id = ctx.uploader_id
    assert session is not None
    assert uploader_id is not None
    content = file.read_bytes()
    content_type = _content_type(file)
    stored = ctx.cache.get(file_id)
    if stored is None:
        stored = await session.get(File, file_id)
        if stored is None:
            stored = File(
                id=file_id,
                session_id=None,
                user_id=uploader_id,
                original_name=file.name,
                content_type=content_type,
                size_bytes=len(content),
                status=FileStatus.PENDING,
            )
            session.add(stored)
            await session.flush()
        ctx.cache[file_id] = stored
    stored.user_id = uploader_id
    stored.original_name = file.name
    stored.content_type = content_type
    previous_size = stored.size_bytes
    stored.size_bytes = len(content)
    stored.session_id = None
    if stored.status is not FileStatus.READY or previous_size != len(content):
        await cos.put_object(
            stored.storage_key,
            content,
            content_type,
            cache_control=storage_keys.PUBLIC_CACHE_CONTROL,
        )
        stored.status = FileStatus.READY
        ctx.stats.uploaded += 1
    else:
        ctx.stats.skipped += 1
    session.add(stored)
    await session.flush()


async def _import_document(
    ctx: Context,
    *,
    collection: MaterialCollection,
    parent: MaterialNode | None,
    path: Path,
    rel_parts: list[str],
    sort_order: int,
) -> None:
    name = path.stem if path.suffix.lower() == ".md" else path.name
    suffix = "" if path.suffix.lower() in _NON_MD_SUFFIXES else ".md"
    document_path = f"/{collection.slug}/" + "/".join([*rel_parts, f"{name}{suffix}"])
    raw = path.read_text(encoding="utf-8", errors="replace")
    content = _FRONTMATTER.sub("", raw, count=1).lstrip("\n") if suffix == ".md" else raw
    content = await _rewrite_images(
        ctx,
        collection=collection,
        document_path=document_path,
        markdown_path=path,
        content=content,
    )
    await ctx.upsert_node(collection, parent, name, content, sort_order)
    ctx.stats.documents += 1
    if ctx.dry_run:
        print(f"[doc] {document_path}")


async def _import_directory(
    ctx: Context,
    *,
    collection: MaterialCollection,
    parent: MaterialNode | None,
    directory: Path,
    rel_parts: list[str],
    skip_subdirs: bool = False,
) -> None:
    entries = sorted(
        (
            entry
            for entry in directory.iterdir()
            if not entry.name.startswith(".")
            or (entry.name == ".templates" and not rel_parts)
        ),
        key=lambda entry: entry.name,
    )
    sort_order = 0
    for entry in entries:
        if entry.is_dir():
            if skip_subdirs:
                continue
            folder = await ctx.upsert_node(collection, parent, entry.name, None, sort_order)
            ctx.stats.folders += 1
            folder_path = f"/{collection.slug}/" + "/".join([*rel_parts, entry.name])
            if ctx.dry_run:
                print(f"[dir] {folder_path}")
            await _import_directory(
                ctx,
                collection=collection,
                parent=folder,
                directory=entry,
                rel_parts=[*rel_parts, entry.name],
                skip_subdirs=entry.name == "figures" and not rel_parts,
            )
            sort_order += 1
            continue
        if entry.is_file() and entry.suffix.lower() in _DOCUMENT_SUFFIXES:
            await _import_document(
                ctx,
                collection=collection,
                parent=parent,
                path=entry,
                rel_parts=rel_parts,
                sort_order=sort_order,
            )
            sort_order += 1


async def _default_uploader(session) -> uuid.UUID:
    statement = (
        select(User)
        .where(
            col(User.role) == UserRole.ADMIN,
            col(User.status) == UserStatus.ACTIVE,
        )
        .order_by(col(User.created_at))
    )
    user = await session.scalar(statement)
    if user is None:
        raise RuntimeError("没有可用的 active admin, 请先创建管理员或用 --uploader-id 指定")
    return user.id


async def _import_collection(
    ctx: Context,
    *,
    spec: CollectionSpec,
    source: Path,
) -> None:
    session = ctx.session
    assert session is not None
    collection = await material_repositories.get_collection_by_slug(
        session,
        spec.slug,
        include_deleted=True,
    )
    if collection is None:
        collection = MaterialCollection(
            slug=spec.slug,
            title=spec.title,
            kind=spec.kind,
            description=spec.description,
            sort_order=spec.sort_order,
        )
        await material_repositories.create_collection(session, collection)
    else:
        collection.deleted_at = None
        collection.title = spec.title
        collection.kind = spec.kind
        collection.description = spec.description
        collection.sort_order = spec.sort_order
        collection.updated_at = datetime.now(UTC)
        session.add(collection)
        await session.flush()
    await _import_directory(
        ctx,
        collection=collection,
        parent=None,
        directory=source,
        rel_parts=[],
    )


async def _run(args: argparse.Namespace) -> int:
    source_root = args.source.resolve()
    if not source_root.is_dir():
        print(f"源目录不存在: {source_root}", file=sys.stderr)
        return 1

    if args.dry_run:
        stats = Stats()
        ctx = Context(
            session=None,
            uploader_id=args.uploader_id,
            dry_run=True,
            source_root=source_root,
            stats=stats,
        )
        for spec in _COLLECTIONS:
            source = source_root / spec.slug
            if not source.is_dir():
                print(f"[skip] 缺少目录: {source}")
                continue
            collection = MaterialCollection(
                slug=spec.slug,
                title=spec.title,
                kind=spec.kind,
                description=spec.description,
                sort_order=spec.sort_order,
            )
            await _import_directory(
                ctx,
                collection=collection,
                parent=None,
                directory=source,
                rel_parts=[],
            )
        print(
            f"[dry-run] folders={stats.folders} documents={stats.documents} "
            f"images={stats.images}"
        )
        for warning in stats.warnings:
            print(f"[warn] {warning}")
        return 0

    await create_db_and_tables()
    try:
        async with session_scope() as session:
            uploader_id = args.uploader_id or await _default_uploader(session)
            stats = Stats()
            ctx = Context(
                session=session,
                uploader_id=uploader_id,
                dry_run=False,
                source_root=source_root,
                stats=stats,
            )
            for spec in _COLLECTIONS:
                source = source_root / spec.slug
                if not source.is_dir():
                    print(f"[skip] 缺少目录: {source}")
                    continue
                await _import_collection(ctx, spec=spec, source=source)
            print(
                f"[done] folders={stats.folders} documents={stats.documents} "
                f"images={stats.images} uploaded={stats.uploaded} "
                f"reused={stats.skipped} uploader={uploader_id}"
            )
            for warning in stats.warnings:
                print(f"[warn] {warning}")
    finally:
        await close_db()
    return 0


def main() -> int:
    return asyncio.run(_run(_parse_args()))


if __name__ == "__main__":
    raise SystemExit(main())
