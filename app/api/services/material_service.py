import re
import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.repositories import file_repositories, material_repositories
from app.api.repositories.models import FileStatus, MaterialCollection, MaterialNode
from app.api.services import file_service
from app.shared.dto import materials as dto
from app.shared.enums import MaterialCollectionKind

_CHAPTER_RE = re.compile(r"^(\d{2})-(.+)$")
_SECTION_RE = re.compile(r"^(\d+(?:\.\d+)+)-(.+)$")
_APPENDIX_RE = re.compile(r"^([A-Z])-(.+)$")
_IMAGE_RE = re.compile(r"/public/materials/([0-9a-fA-F-]{36})")
_NON_MD_SUFFIXES = {".html", ".txt", ".json"}


class MaterialError(Exception):
    pass


class CollectionNotFoundError(MaterialError):
    pass


class NodeNotFoundError(MaterialError):
    pass


class DuplicateNameError(MaterialError):
    pass


class InvalidNodeError(MaterialError):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class InvalidMoveError(MaterialError):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


@dataclass(frozen=True, slots=True)
class NodeView:
    node: MaterialNode
    collection: MaterialCollection
    kind: Literal["folder", "document"]
    title: str
    path: str


@dataclass(slots=True)
class Library:
    collections: list[MaterialCollection]
    nodes: list[MaterialNode]
    views: dict[uuid.UUID, NodeView]
    grouped: dict[tuple[uuid.UUID, uuid.UUID | None], list[MaterialNode]]


def display_title(
    *,
    name: str,
    kind: str,
    parent_name: str | None,
    is_collection_root: bool,
    collection_kind: MaterialCollectionKind,
) -> str:
    if name == "00-toc":
        return "全书目录"
    if name == "00-索引":
        return "题库索引"
    if name == "index" and parent_name == "figures":
        return "图注索引"
    if name == "appendices":
        return "附录"
    if name == "figures":
        return "图表"
    if (
        kind == "folder"
        and is_collection_root
        and collection_kind is MaterialCollectionKind.TEXTBOOK
    ):
        match = _CHAPTER_RE.match(name)
        if match:
            return f"第{int(match.group(1))}章 {match.group(2)}"
    match = _SECTION_RE.match(name)
    if match:
        return f"{match.group(1)} {match.group(2)}"
    match = _APPENDIX_RE.match(name)
    if match:
        return f"{match.group(1)} {match.group(2)}"
    return name


def _ordered(nodes: list[MaterialNode]) -> list[MaterialNode]:
    return sorted(nodes, key=lambda node: (node.sort_order, node.name))


def _build_library(collections: list[MaterialCollection], nodes: list[MaterialNode]) -> Library:
    grouped: dict[tuple[uuid.UUID, uuid.UUID | None], list[MaterialNode]] = defaultdict(list)
    for node in nodes:
        grouped[(node.collection_id, node.parent_id)].append(node)

    views: dict[uuid.UUID, NodeView] = {}

    def visit(
        collection: MaterialCollection,
        node: MaterialNode,
        parent_path: str,
        parent_name: str | None,
        is_collection_root: bool,
    ) -> None:
        kind = "folder" if node.content is None else "document"
        segment = node.name
        if kind == "document" and Path(node.name).suffix.lower() not in _NON_MD_SUFFIXES:
            segment = f"{node.name}.md"
        path = f"{parent_path}/{segment}"
        title = display_title(
            name=node.name,
            kind=kind,
            parent_name=parent_name,
            is_collection_root=is_collection_root,
            collection_kind=collection.kind,
        )
        views[node.id] = NodeView(
            node=node,
            collection=collection,
            kind=kind,
            title=title,
            path=path,
        )
        if kind == "folder":
            for child in _ordered(grouped.get((node.collection_id, node.id), [])):
                visit(collection, child, path, node.name, False)

    for collection in collections:
        for node in _ordered(grouped.get((collection.id, None), [])):
            visit(collection, node, f"/{collection.slug}", None, True)

    return Library(
        collections=collections,
        nodes=nodes,
        views=views,
        grouped=grouped,
    )


async def _load_library(session: AsyncSession) -> Library:
    collections = await material_repositories.list_collections(session)
    nodes = await material_repositories.list_active_nodes(
        session,
        collection_ids=[collection.id for collection in collections],
    )
    return _build_library(collections, nodes)


def collection_item(collection: MaterialCollection) -> dto.MaterialCollectionItem:
    return dto.MaterialCollectionItem(
        id=collection.id,
        slug=collection.slug,
        title=collection.title,
        kind=collection.kind,
        description=collection.description,
        sort_order=collection.sort_order,
    )


def _node_summary(library: Library, node: MaterialNode) -> dto.MaterialNodeSummary:
    view = library.views[node.id]
    children = (
        [
            _node_summary(library, child)
            for child in _ordered(library.grouped.get((node.collection_id, node.id), []))
        ]
        if view.kind == "folder"
        else []
    )
    return dto.MaterialNodeSummary(
        id=node.id,
        parent_id=node.parent_id,
        kind=view.kind,
        name=node.name,
        title=view.title,
        path=view.path,
        sort_order=node.sort_order,
        children=children,
    )


def _tree(library: Library) -> list[dto.MaterialCollectionTree]:
    items: list[dto.MaterialCollectionTree] = []
    for collection in library.collections:
        roots = _ordered(library.grouped.get((collection.id, None), []))
        items.append(
            dto.MaterialCollectionTree(
                **collection_item(collection).model_dump(),
                children=[_node_summary(library, node) for node in roots],
            )
        )
    return items


def _visible(
    items: list[MaterialCollection],
    *,
    include_hidden: bool,
) -> list[MaterialCollection]:
    if include_hidden:
        return items
    return [item for item in items if not item.slug.startswith(".")]


async def get_tree(
    session: AsyncSession,
    *,
    include_hidden: bool = False,
) -> dto.MaterialTreeResponse:
    library = await _load_library(session)
    library.collections = _visible(library.collections, include_hidden=include_hidden)
    return dto.MaterialTreeResponse(items=_tree(library))


async def get_collections(
    session: AsyncSession,
    *,
    include_hidden: bool = False,
) -> dto.MaterialCollectionListResponse:
    collections = _visible(
        await material_repositories.list_collections(session),
        include_hidden=include_hidden,
    )
    return dto.MaterialCollectionListResponse(
        items=[collection_item(collection) for collection in collections],
    )


def _normalize_path(path: str) -> str:
    value = (path or "/").strip()
    if not value.startswith("/"):
        raise InvalidNodeError("路径必须以 / 开头")
    if len(value) > 1:
        value = value.rstrip("/")
    return value


def _collection_by_path(library: Library, path: str) -> MaterialCollection | None:
    slug = path.strip("/")
    if not slug or "/" in slug:
        return None
    for collection in library.collections:
        if collection.slug == slug:
            return collection
    return None


def _find_by_path(library: Library, path: str) -> NodeView:
    normalized = _normalize_path(path)
    for view in library.views.values():
        if view.path == normalized:
            return view
    if not normalized.endswith(".md"):
        document_path = f"{normalized}.md"
        for view in library.views.values():
            if view.path == document_path:
                return view
    raise NodeNotFoundError


def _ls_items(library: Library, nodes: list[MaterialNode]) -> list[dto.InternalMaterialLsItem]:
    return [
        dto.InternalMaterialLsItem(
            id=node.id,
            kind=library.views[node.id].kind,
            name=node.name,
            path=library.views[node.id].path,
        )
        for node in nodes
    ]


def _ancestors(library: Library, node: MaterialNode) -> list[NodeView]:
    chain: list[NodeView] = []
    current = node.parent_id
    while current is not None:
        view = library.views.get(current)
        if view is None:
            break
        chain.append(view)
        current = view.node.parent_id
    chain.reverse()
    return chain


def _breadcrumbs(library: Library, node: MaterialNode) -> list[dto.MaterialBreadcrumb]:
    view = library.views[node.id]
    crumbs = [
        dto.MaterialBreadcrumb(
            id=view.collection.id,
            title=view.collection.title,
            kind="collection",
        )
    ]
    for ancestor in _ancestors(library, node):
        crumbs.append(
            dto.MaterialBreadcrumb(
                id=ancestor.node.id,
                title=ancestor.title,
                kind="folder",
            )
        )
    return crumbs


def _document_order(library: Library, collection: MaterialCollection) -> list[NodeView]:
    ordered: list[NodeView] = []

    def visit(node: MaterialNode) -> None:
        view = library.views[node.id]
        if view.kind == "document":
            ordered.append(view)
            return
        for child in _ordered(library.grouped.get((collection.id, node.id), [])):
            visit(child)

    for node in _ordered(library.grouped.get((collection.id, None), [])):
        visit(node)
    return ordered


def _neighbors(
    library: Library,
    view: NodeView,
) -> tuple[dto.MaterialNodeRef | None, dto.MaterialNodeRef | None]:
    if view.kind != "document":
        return None, None
    documents = _document_order(library, view.collection)
    index = next(
        (position for position, item in enumerate(documents) if item.node.id == view.node.id),
        None,
    )
    if index is None:
        return None, None
    previous = documents[index - 1] if index > 0 else None
    following = documents[index + 1] if index + 1 < len(documents) else None
    return (
        dto.MaterialNodeRef(id=previous.node.id, title=previous.title, path=previous.path)
        if previous
        else None,
        dto.MaterialNodeRef(id=following.node.id, title=following.title, path=following.path)
        if following
        else None,
    )


def _image_ids(content: str) -> list[uuid.UUID]:
    ids: list[uuid.UUID] = []
    for match in _IMAGE_RE.finditer(content):
        try:
            file_id = uuid.UUID(match.group(1))
        except ValueError:
            continue
        if file_id not in ids:
            ids.append(file_id)
    return ids


async def _image_assets(
    session: AsyncSession,
    content: str,
    *,
    max_images: int | None = None,
) -> list[dto.MaterialImageAsset]:
    file_ids = _image_ids(content)
    if max_images is not None:
        file_ids = file_ids[:max_images]
    if not file_ids:
        return []
    files = await file_repositories.get_by_ids(session, file_ids)
    by_id = {file.id: file for file in files}
    assets: list[dto.MaterialImageAsset] = []
    for file_id in file_ids:
        file = by_id.get(file_id)
        if file is None or file.deleted_at is not None:
            continue
        if file.status is not FileStatus.READY or file.session_id is not None:
            continue
        if not file.content_type.startswith("image/"):
            continue
        assets.append(
            dto.MaterialImageAsset(
                file_id=file.id,
                name=file.original_name,
                content_type=file.content_type,
                url=file_service.public_url(file),
            )
        )
    return assets


def _detail(
    library: Library,
    view: NodeView,
    images: list[dto.MaterialImageAsset],
) -> dto.MaterialNodeDetail:
    prev, next_ = _neighbors(library, view)
    return dto.MaterialNodeDetail(
        id=view.node.id,
        collection_id=view.node.collection_id,
        parent_id=view.node.parent_id,
        kind=view.kind,
        name=view.node.name,
        title=view.title,
        path=view.path,
        sort_order=view.node.sort_order,
        content=view.node.content,
        collection=collection_item(view.collection),
        breadcrumbs=_breadcrumbs(library, view.node),
        prev=prev,
        next=next_,
        images=images,
        updated_at=view.node.updated_at,
    )


async def get_node_detail(session: AsyncSession, node_id: uuid.UUID) -> dto.MaterialNodeDetail:
    library = await _load_library(session)
    view = library.views.get(node_id)
    if view is None:
        raise NodeNotFoundError
    images = (
        await _image_assets(session, view.node.content)
        if view.node.content is not None
        else []
    )
    return _detail(library, view, images)


async def get_node_detail_by_path(session: AsyncSession, path: str) -> dto.MaterialNodeDetail:
    library = await _load_library(session)
    view = _find_by_path(library, path)
    images = (
        await _image_assets(session, view.node.content)
        if view.node.content is not None
        else []
    )
    return _detail(library, view, images)


def _snippet(content: str, query: str) -> str:
    needle = query.casefold()
    for line in content.splitlines():
        if needle in line.casefold():
            text = line.strip()
            return text[:160]
    return ""


async def search_documents(
    session: AsyncSession,
    *,
    query: str,
    collection_id: uuid.UUID | None,
    limit: int,
    include_hidden: bool = False,
) -> dto.MaterialSearchResponse:
    library = await _load_library(session)
    collection_ids = [collection_id] if collection_id is not None else None
    nodes = await material_repositories.search_nodes(
        session,
        query=query,
        collection_ids=collection_ids,
    )
    items: list[dto.MaterialSearchItem] = []
    for node in nodes:
        view = library.views.get(node.id)
        if view is None:
            continue
        if not include_hidden and view.collection.slug.startswith("."):
            continue
        content = node.content or ""
        snippet = _snippet(content, query)
        if not snippet and query.casefold() in node.name.casefold():
            snippet = view.title
        items.append(
            dto.MaterialSearchItem(
                id=node.id,
                title=view.title,
                path=view.path,
                snippet=snippet,
            )
        )
    items.sort(key=lambda item: item.path)
    return dto.MaterialSearchResponse(items=items[:limit])


async def list_children(session: AsyncSession, path: str) -> dto.InternalMaterialLsResponse:
    library = await _load_library(session)
    normalized = _normalize_path(path)
    if normalized == "/":
        return dto.InternalMaterialLsResponse(
            path="/",
            items=[
                dto.InternalMaterialLsItem(
                    id=collection.id,
                    kind="folder",
                    name=collection.slug,
                    path=f"/{collection.slug}",
                )
                for collection in library.collections
            ],
        )
    collection = _collection_by_path(library, normalized)
    if collection is not None:
        children = _ordered(library.grouped.get((collection.id, None), []))
        return dto.InternalMaterialLsResponse(
            path=f"/{collection.slug}",
            items=_ls_items(library, children),
        )
    view = _find_by_path(library, normalized)
    if view.kind != "folder":
        raise InvalidNodeError("不是目录")
    children = _ordered(library.grouped.get((view.node.collection_id, view.node.id), []))
    return dto.InternalMaterialLsResponse(
        path=view.path,
        items=_ls_items(library, children),
    )


async def read_document(
    session: AsyncSession,
    *,
    path: str,
    offset: int,
    limit: int,
    include_images: bool,
    max_images: int,
) -> dto.InternalMaterialReadResponse:
    library = await _load_library(session)
    view = _find_by_path(library, path)
    if view.kind != "document" or view.node.content is None:
        raise InvalidNodeError("不是文件")
    lines = view.node.content.splitlines()
    content = "\n".join(lines[offset - 1 : offset - 1 + limit])
    images = (
        await _image_assets(session, content, max_images=max_images)
        if include_images
        else []
    )
    return dto.InternalMaterialReadResponse(
        id=view.node.id,
        collection_id=view.node.collection_id,
        title=view.title,
        path=view.path,
        content=content,
        images=[
            dto.InternalMaterialImage(
                file_id=image.file_id,
                name=image.name,
                content_type=image.content_type,
                url=image.url,
            )
            for image in images
        ],
    )


async def search_lines(
    session: AsyncSession,
    *,
    query: str,
    path: str,
    limit: int,
) -> dto.InternalMaterialSearchResponse:
    library = await _load_library(session)
    normalized = _normalize_path(path)
    if normalized == "/":
        scoped = [view for view in library.views.values() if view.kind == "document"]
    else:
        collection = _collection_by_path(library, normalized)
        if collection is not None:
            scoped = [
                library.views[node.id]
                for node in library.nodes
                if node.collection_id == collection.id
                and library.views[node.id].kind == "document"
            ]
        else:
            view = _find_by_path(library, normalized)
            if view.kind == "document":
                scoped = [view]
            else:
                prefix = f"{view.path}/"
                scoped = [
                    item
                    for item in library.views.values()
                    if item.kind == "document" and item.path.startswith(prefix)
                ]
    needle = query.casefold()
    items: list[dto.InternalMaterialSearchItem] = []
    for view in sorted(scoped, key=lambda item: item.path):
        content = view.node.content or ""
        for number, line in enumerate(content.splitlines(), start=1):
            if needle in line.casefold():
                items.append(
                    dto.InternalMaterialSearchItem(
                        id=view.node.id,
                        path=view.path,
                        line=number,
                        text=line.strip(),
                    )
                )
                if len(items) >= limit:
                    return dto.InternalMaterialSearchResponse(items=items)
    return dto.InternalMaterialSearchResponse(items=items)


def _validated_name(name: str, *, is_document: bool) -> str:
    value = name.strip()
    if is_document and value.lower().endswith(".md"):
        value = value[:-3]
    if not value:
        raise InvalidNodeError("名称不能为空")
    if value in {".", ".."} or ".." in value:
        raise InvalidNodeError("名称不能包含 ..")
    if "/" in value or "\\" in value:
        raise InvalidNodeError("名称不能包含路径分隔符")
    if any(ord(char) < 32 or ord(char) == 127 for char in value):
        raise InvalidNodeError("名称包含非法字符")
    if len(value) > 255:
        raise InvalidNodeError("名称过长")
    return value


async def _require_collection(
    session: AsyncSession,
    collection_id: uuid.UUID,
) -> MaterialCollection:
    collection = await material_repositories.get_collection(session, collection_id)
    if collection is None:
        raise CollectionNotFoundError
    return collection


async def _require_node(session: AsyncSession, node_id: uuid.UUID) -> MaterialNode:
    node = await material_repositories.get_node(session, node_id)
    if node is None:
        raise NodeNotFoundError
    return node


async def _next_sort_order(
    session: AsyncSession,
    *,
    collection_id: uuid.UUID,
    parent_id: uuid.UUID | None,
) -> int:
    current = await material_repositories.max_sort_order(
        session,
        collection_id=collection_id,
        parent_id=parent_id,
    )
    return 0 if current is None else current + 1


async def create_node(
    session: AsyncSession,
    payload: dto.MaterialNodeCreateRequest,
) -> MaterialNode:
    await _require_collection(session, payload.collection_id)
    parent = None
    if payload.parent_id is not None:
        parent = await material_repositories.get_node(session, payload.parent_id)
        if parent is None or parent.collection_id != payload.collection_id:
            raise InvalidNodeError("父目录不存在")
        if parent.content is not None:
            raise InvalidNodeError("父节点不是目录")
    name = _validated_name(payload.name, is_document=payload.content is not None)
    duplicate = await material_repositories.find_sibling(
        session,
        collection_id=payload.collection_id,
        parent_id=payload.parent_id,
        name=name,
    )
    if duplicate is not None:
        raise DuplicateNameError
    sort_order = payload.sort_order
    if sort_order is None:
        sort_order = await _next_sort_order(
            session,
            collection_id=payload.collection_id,
            parent_id=payload.parent_id,
        )
    node = MaterialNode(
        collection_id=payload.collection_id,
        parent_id=payload.parent_id,
        name=name,
        content=payload.content,
        sort_order=sort_order,
    )
    return await material_repositories.create_node(session, node)


def _is_descendant(
    library: Library,
    *,
    node_id: uuid.UUID,
    candidate_id: uuid.UUID,
) -> bool:
    current: uuid.UUID | None = candidate_id
    while current is not None:
        if current == node_id:
            return True
        view = library.views.get(current)
        current = view.node.parent_id if view is not None else None
    return False


async def update_node(
    session: AsyncSession,
    node_id: uuid.UUID,
    payload: dto.MaterialNodeUpdateRequest,
) -> MaterialNode:
    node = await _require_node(session, node_id)
    fields = payload.model_fields_set
    content = node.content
    if "content" in fields:
        content = payload.content
    name = node.name
    if payload.name is not None:
        name = _validated_name(payload.name, is_document=content is not None)
    parent_id = node.parent_id
    library: Library | None = None
    if "parent_id" in fields:
        parent_id = payload.parent_id
        if parent_id is not None:
            parent = await material_repositories.get_node(session, parent_id)
            if parent is None or parent.collection_id != node.collection_id:
                raise InvalidNodeError("父目录不存在")
            if parent.content is not None:
                raise InvalidNodeError("父节点不是目录")
            library = await _load_library(session)
            if not _is_descendant(library, node_id=node.id, candidate_id=parent_id):
                raise InvalidMoveError("不能移动到自身或子节点下")
    if name != node.name or parent_id != node.parent_id:
        duplicate = await material_repositories.find_sibling(
            session,
            collection_id=node.collection_id,
            parent_id=parent_id,
            name=name,
            exclude_id=node.id,
        )
        if duplicate is not None:
            raise DuplicateNameError
    node.name = name
    node.content = content
    node.parent_id = parent_id
    if payload.sort_order is not None:
        node.sort_order = payload.sort_order
    node.updated_at = datetime.now(UTC)
    session.add(node)
    await session.flush()
    return node


async def delete_node(session: AsyncSession, node_id: uuid.UUID) -> None:
    node = await _require_node(session, node_id)
    nodes = await material_repositories.list_active_nodes(
        session,
        collection_ids=[node.collection_id],
    )
    children: dict[uuid.UUID | None, list[MaterialNode]] = defaultdict(list)
    for item in nodes:
        children[item.parent_id].append(item)
    now = datetime.now(UTC)
    pending = [node]
    while pending:
        current = pending.pop()
        current.deleted_at = now
        current.updated_at = now
        session.add(current)
        pending.extend(children.get(current.id, []))
    await session.flush()


async def reorder_nodes(
    session: AsyncSession,
    payload: dto.MaterialNodeReorderRequest,
) -> None:
    ids = [item.id for item in payload.items]
    nodes = await material_repositories.get_nodes_by_ids(session, ids)
    by_id = {node.id: node for node in nodes}
    if len(by_id) != len(set(ids)):
        raise NodeNotFoundError
    groups = {(node.collection_id, node.parent_id) for node in nodes}
    if len(groups) != 1:
        raise InvalidNodeError("只能调整同一目录下的顺序")
    orders = {item.id: item.sort_order for item in payload.items}
    for node in nodes:
        node.sort_order = orders[node.id]
        node.updated_at = datetime.now(UTC)
        session.add(node)
    await session.flush()


async def create_collection(
    session: AsyncSession,
    payload: dto.MaterialCollectionCreateRequest,
) -> MaterialCollection:
    existing = await material_repositories.get_collection_by_slug(
        session,
        payload.slug,
        include_deleted=True,
    )
    if existing is not None:
        raise DuplicateNameError
    collection = MaterialCollection(
        slug=payload.slug,
        title=payload.title,
        kind=payload.kind,
        description=payload.description,
        sort_order=payload.sort_order,
    )
    return await material_repositories.create_collection(session, collection)


async def update_collection(
    session: AsyncSession,
    collection_id: uuid.UUID,
    payload: dto.MaterialCollectionUpdateRequest,
) -> MaterialCollection:
    collection = await _require_collection(session, collection_id)
    if payload.title is not None:
        collection.title = payload.title
    if payload.description is not None:
        collection.description = payload.description
    if payload.sort_order is not None:
        collection.sort_order = payload.sort_order
    collection.updated_at = datetime.now(UTC)
    session.add(collection)
    await session.flush()
    return collection


async def delete_collection(session: AsyncSession, collection_id: uuid.UUID) -> None:
    collection = await _require_collection(session, collection_id)
    nodes = await material_repositories.list_active_nodes(
        session,
        collection_ids=[collection.id],
    )
    now = datetime.now(UTC)
    collection.deleted_at = now
    collection.updated_at = now
    session.add(collection)
    for node in nodes:
        node.deleted_at = now
        node.updated_at = now
        session.add(node)
    await session.flush()
