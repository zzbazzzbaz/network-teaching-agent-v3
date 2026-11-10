import uuid
from typing import Annotated

from fastapi import APIRouter, Query

from app.api.dependencies import InternalUser, SessionDep
from app.api.services import material_service
from app.shared.dto.materials import (
    InternalMaterialImage,
    InternalMaterialLsResponse,
    InternalMaterialReadResponse,
    InternalMaterialSearchResponse,
    MaterialNodeDetail,
    MaterialTreeResponse,
)
from app.shared.errors import not_found

router = APIRouter(
    prefix="/internal/materials",
    tags=["内部接口"],
    include_in_schema=False,
)


def _read_response(detail: MaterialNodeDetail) -> InternalMaterialReadResponse:
    return InternalMaterialReadResponse(
        id=detail.id,
        collection_id=detail.collection_id,
        title=detail.title,
        path=detail.path,
        content=detail.content or "",
        images=[
            InternalMaterialImage(
                file_id=image.file_id,
                name=image.name,
                content_type=image.content_type,
                url=image.url,
            )
            for image in detail.images
        ],
    )


@router.get("/tree", response_model=MaterialTreeResponse, summary="资料库目录树")
async def get_tree(
    session: SessionDep,
    _user: InternalUser,
) -> MaterialTreeResponse:
    return await material_service.get_tree(session, include_hidden=True)


@router.get("/ls", response_model=InternalMaterialLsResponse, summary="列出目录")
async def list_children(
    session: SessionDep,
    _user: InternalUser,
    path: Annotated[str, Query(max_length=1024)] = "/",
) -> InternalMaterialLsResponse:
    try:
        return await material_service.list_children(session, path)
    except (material_service.NodeNotFoundError, material_service.InvalidNodeError) as exc:
        raise not_found() from exc


@router.get("/read", response_model=InternalMaterialReadResponse, summary="读取文档")
async def read_document(
    session: SessionDep,
    _user: InternalUser,
    path: Annotated[str, Query(min_length=1, max_length=1024)],
    offset: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=500)] = 300,
    include_images: bool = True,
    max_images: Annotated[int, Query(ge=0, le=20)] = 6,
) -> InternalMaterialReadResponse:
    try:
        return await material_service.read_document(
            session,
            path=path,
            offset=offset,
            limit=limit,
            include_images=include_images,
            max_images=max_images,
        )
    except (material_service.NodeNotFoundError, material_service.InvalidNodeError) as exc:
        raise not_found() from exc


@router.get(
    "/search",
    response_model=InternalMaterialSearchResponse,
    summary="搜索资料",
)
async def search(
    session: SessionDep,
    _user: InternalUser,
    q: Annotated[str, Query(min_length=1, max_length=100)],
    path: Annotated[str, Query(max_length=1024)] = "/",
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> InternalMaterialSearchResponse:
    try:
        return await material_service.search_lines(
            session,
            query=q,
            path=path,
            limit=limit,
        )
    except (material_service.NodeNotFoundError, material_service.InvalidNodeError) as exc:
        raise not_found() from exc


@router.get(
    "/nodes/by-path",
    response_model=InternalMaterialReadResponse,
    summary="按路径读取节点",
)
async def read_node_by_path(
    session: SessionDep,
    _user: InternalUser,
    path: Annotated[str, Query(min_length=1, max_length=1024)],
) -> InternalMaterialReadResponse:
    try:
        detail = await material_service.get_node_detail_by_path(session, path)
    except (material_service.NodeNotFoundError, material_service.InvalidNodeError) as exc:
        raise not_found() from exc
    return _read_response(detail)


@router.get(
    "/nodes/{node_id}",
    response_model=InternalMaterialReadResponse,
    summary="按 id 读取节点",
)
async def read_node(
    node_id: uuid.UUID,
    session: SessionDep,
    _user: InternalUser,
) -> InternalMaterialReadResponse:
    try:
        detail = await material_service.get_node_detail(session, node_id)
    except material_service.NodeNotFoundError as exc:
        raise not_found() from exc
    return _read_response(detail)
