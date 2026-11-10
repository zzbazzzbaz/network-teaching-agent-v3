import uuid
from typing import Annotated

from fastapi import APIRouter, Query

from app.api.dependencies import CurrentUser, SessionDep
from app.api.services import material_service
from app.shared.dto.materials import (
    MaterialCollectionListResponse,
    MaterialNodeDetail,
    MaterialSearchResponse,
    MaterialTreeResponse,
)
from app.shared.errors import not_found

router = APIRouter(prefix="/materials", tags=["教材内容"])


@router.get("/tree", response_model=MaterialTreeResponse, summary="教材与题库目录树")
async def get_tree(
    session: SessionDep,
    _user: CurrentUser,
) -> MaterialTreeResponse:
    return await material_service.get_tree(session)


@router.get(
    "/collections",
    response_model=MaterialCollectionListResponse,
    summary="教材与题库列表",
)
async def list_collections(
    session: SessionDep,
    _user: CurrentUser,
) -> MaterialCollectionListResponse:
    return await material_service.get_collections(session)


@router.get(
    "/nodes/by-path",
    response_model=MaterialNodeDetail,
    summary="按路径读取节点",
)
async def get_node_by_path(
    session: SessionDep,
    _user: CurrentUser,
    path: Annotated[str, Query(min_length=1, max_length=1024)],
) -> MaterialNodeDetail:
    try:
        return await material_service.get_node_detail_by_path(session, path)
    except (material_service.NodeNotFoundError, material_service.InvalidNodeError) as exc:
        raise not_found() from exc


@router.get("/nodes/{node_id}", response_model=MaterialNodeDetail, summary="节点详情")
async def get_node(
    node_id: uuid.UUID,
    session: SessionDep,
    _user: CurrentUser,
) -> MaterialNodeDetail:
    try:
        return await material_service.get_node_detail(session, node_id)
    except material_service.NodeNotFoundError as exc:
        raise not_found() from exc


@router.get("/search", response_model=MaterialSearchResponse, summary="搜索教材内容")
async def search(
    session: SessionDep,
    _user: CurrentUser,
    q: Annotated[str, Query(min_length=1, max_length=100)],
    collection_id: uuid.UUID | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> MaterialSearchResponse:
    return await material_service.search_documents(
        session,
        query=q,
        collection_id=collection_id,
        limit=limit,
    )
