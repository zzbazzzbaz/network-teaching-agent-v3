import uuid
from collections.abc import Sequence

from sqlalchemy import func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement
from sqlmodel import col, select

from app.api.repositories.models import MaterialCollection, MaterialNode


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


async def list_collections(session: AsyncSession) -> list[MaterialCollection]:
    statement = (
        select(MaterialCollection)
        .where(col(MaterialCollection.deleted_at).is_(None))
        .order_by(
            col(MaterialCollection.sort_order),
            col(MaterialCollection.slug),
        )
    )
    return list((await session.execute(statement)).scalars().all())


async def get_collection(
    session: AsyncSession,
    collection_id: uuid.UUID,
    *,
    include_deleted: bool = False,
) -> MaterialCollection | None:
    collection = await session.get(MaterialCollection, collection_id)
    if collection is None:
        return None
    if not include_deleted and collection.deleted_at is not None:
        return None
    return collection


async def get_collection_by_slug(
    session: AsyncSession,
    slug: str,
    *,
    include_deleted: bool = False,
) -> MaterialCollection | None:
    statement = select(MaterialCollection).where(col(MaterialCollection.slug) == slug)
    collection = await session.scalar(statement)
    if collection is None:
        return None
    if not include_deleted and collection.deleted_at is not None:
        return None
    return collection


async def create_collection(
    session: AsyncSession,
    collection: MaterialCollection,
) -> MaterialCollection:
    session.add(collection)
    await session.flush()
    return collection


async def list_active_nodes(
    session: AsyncSession,
    *,
    collection_ids: Sequence[uuid.UUID] | None = None,
) -> list[MaterialNode]:
    filters: list[ColumnElement[bool]] = [col(MaterialNode.deleted_at).is_(None)]
    if collection_ids is not None:
        filters.append(col(MaterialNode.collection_id).in_(list(collection_ids)))
    statement = select(MaterialNode).where(*filters)
    return list((await session.execute(statement)).scalars().all())


async def get_node(
    session: AsyncSession,
    node_id: uuid.UUID,
    *,
    include_deleted: bool = False,
) -> MaterialNode | None:
    node = await session.get(MaterialNode, node_id)
    if node is None:
        return None
    if not include_deleted and node.deleted_at is not None:
        return None
    return node


async def get_nodes_by_ids(
    session: AsyncSession,
    node_ids: Sequence[uuid.UUID],
) -> list[MaterialNode]:
    if not node_ids:
        return []
    statement = select(MaterialNode).where(
        col(MaterialNode.id).in_(list(node_ids)),
        col(MaterialNode.deleted_at).is_(None),
    )
    return list((await session.execute(statement)).scalars().all())


async def find_sibling(
    session: AsyncSession,
    *,
    collection_id: uuid.UUID,
    parent_id: uuid.UUID | None,
    name: str,
    exclude_id: uuid.UUID | None = None,
) -> MaterialNode | None:
    filters: list[ColumnElement[bool]] = [
        col(MaterialNode.collection_id) == collection_id,
        col(MaterialNode.name) == name,
        col(MaterialNode.deleted_at).is_(None),
    ]
    if parent_id is None:
        filters.append(col(MaterialNode.parent_id).is_(None))
    else:
        filters.append(col(MaterialNode.parent_id) == parent_id)
    if exclude_id is not None:
        filters.append(col(MaterialNode.id) != exclude_id)
    return await session.scalar(select(MaterialNode).where(*filters))


async def max_sort_order(
    session: AsyncSession,
    *,
    collection_id: uuid.UUID,
    parent_id: uuid.UUID | None,
) -> int | None:
    filters: list[ColumnElement[bool]] = [
        col(MaterialNode.collection_id) == collection_id,
        col(MaterialNode.deleted_at).is_(None),
    ]
    if parent_id is None:
        filters.append(col(MaterialNode.parent_id).is_(None))
    else:
        filters.append(col(MaterialNode.parent_id) == parent_id)
    return await session.scalar(select(func.max(col(MaterialNode.sort_order))).where(*filters))


async def create_node(session: AsyncSession, node: MaterialNode) -> MaterialNode:
    session.add(node)
    await session.flush()
    return node


async def search_nodes(
    session: AsyncSession,
    *,
    query: str,
    collection_ids: Sequence[uuid.UUID] | None = None,
) -> list[MaterialNode]:
    escaped = _escape_like(query)
    filters: list[ColumnElement[bool]] = [
        col(MaterialNode.deleted_at).is_(None),
        col(MaterialNode.content).is_not(None),
        or_(
            col(MaterialNode.name).ilike(f"%{escaped}%", escape="\\"),
            col(MaterialNode.content).ilike(f"%{escaped}%", escape="\\"),
        ),
    ]
    if collection_ids is not None:
        filters.append(col(MaterialNode.collection_id).in_(list(collection_ids)))
    statement = select(MaterialNode).where(*filters)
    return list((await session.execute(statement)).scalars().all())
