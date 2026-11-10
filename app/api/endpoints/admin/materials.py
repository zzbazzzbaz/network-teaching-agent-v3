import uuid

from fastapi import APIRouter, HTTPException, status

from app.api.dependencies import AdminUser, SessionDep
from app.api.services import file_service, material_service
from app.api.services.material_service import (
    CollectionNotFoundError,
    DuplicateNameError,
    InvalidMoveError,
    InvalidNodeError,
    NodeNotFoundError,
)
from app.shared.dto.materials import (
    MaterialAssetCompleteResponse,
    MaterialAssetUploadUrlRequest,
    MaterialAssetUploadUrlResponse,
    MaterialCollectionCreateRequest,
    MaterialCollectionItem,
    MaterialCollectionUpdateRequest,
    MaterialNodeCreateRequest,
    MaterialNodeDetail,
    MaterialNodeReorderRequest,
    MaterialNodeUpdateRequest,
)
from app.shared.errors import not_found

router = APIRouter(prefix="/materials", tags=["管理-教材内容"])


def _material_error(exc: Exception) -> HTTPException:
    if isinstance(exc, (CollectionNotFoundError, NodeNotFoundError)):
        return not_found()
    if isinstance(exc, DuplicateNameError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail="同级名称已存在")
    if isinstance(exc, (InvalidNodeError, InvalidMoveError)):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=exc.detail,
        )
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请求无法完成")


@router.post(
    "/collections",
    response_model=MaterialCollectionItem,
    status_code=status.HTTP_201_CREATED,
    summary="新建教材或题库",
)
async def create_collection(
    payload: MaterialCollectionCreateRequest,
    session: SessionDep,
    _admin: AdminUser,
) -> MaterialCollectionItem:
    try:
        collection = await material_service.create_collection(session, payload)
    except DuplicateNameError as exc:
        raise _material_error(exc) from exc
    await session.commit()
    return material_service.collection_item(collection)


@router.patch(
    "/collections/{collection_id}",
    response_model=MaterialCollectionItem,
    summary="修改教材或题库",
)
async def update_collection(
    collection_id: uuid.UUID,
    payload: MaterialCollectionUpdateRequest,
    session: SessionDep,
    _admin: AdminUser,
) -> MaterialCollectionItem:
    try:
        collection = await material_service.update_collection(session, collection_id, payload)
    except CollectionNotFoundError as exc:
        raise _material_error(exc) from exc
    await session.commit()
    return material_service.collection_item(collection)


@router.delete(
    "/collections/{collection_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除教材或题库",
)
async def delete_collection(
    collection_id: uuid.UUID,
    session: SessionDep,
    _admin: AdminUser,
) -> None:
    try:
        await material_service.delete_collection(session, collection_id)
    except CollectionNotFoundError as exc:
        raise _material_error(exc) from exc
    await session.commit()


@router.post(
    "/nodes",
    response_model=MaterialNodeDetail,
    status_code=status.HTTP_201_CREATED,
    summary="新建目录或文档",
)
async def create_node(
    payload: MaterialNodeCreateRequest,
    session: SessionDep,
    _admin: AdminUser,
) -> MaterialNodeDetail:
    try:
        node = await material_service.create_node(session, payload)
    except (CollectionNotFoundError, InvalidNodeError, DuplicateNameError) as exc:
        raise _material_error(exc) from exc
    await session.commit()
    return await material_service.get_node_detail(session, node.id)


@router.post(
    "/nodes/reorder",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="调整同级节点顺序",
)
async def reorder_nodes(
    payload: MaterialNodeReorderRequest,
    session: SessionDep,
    _admin: AdminUser,
) -> None:
    try:
        await material_service.reorder_nodes(session, payload)
    except (NodeNotFoundError, InvalidNodeError) as exc:
        raise _material_error(exc) from exc
    await session.commit()


@router.patch(
    "/nodes/{node_id}",
    response_model=MaterialNodeDetail,
    summary="修改节点",
)
async def update_node(
    node_id: uuid.UUID,
    payload: MaterialNodeUpdateRequest,
    session: SessionDep,
    _admin: AdminUser,
) -> MaterialNodeDetail:
    try:
        node = await material_service.update_node(session, node_id, payload)
    except (NodeNotFoundError, InvalidNodeError, InvalidMoveError, DuplicateNameError) as exc:
        raise _material_error(exc) from exc
    await session.commit()
    return await material_service.get_node_detail(session, node.id)


@router.delete(
    "/nodes/{node_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除节点",
)
async def delete_node(
    node_id: uuid.UUID,
    session: SessionDep,
    _admin: AdminUser,
) -> None:
    try:
        await material_service.delete_node(session, node_id)
    except NodeNotFoundError as exc:
        raise _material_error(exc) from exc
    await session.commit()


@router.post(
    "/nodes/{node_id}/assets/upload-url",
    response_model=MaterialAssetUploadUrlResponse,
    status_code=status.HTTP_201_CREATED,
    summary="申请教材图片直传地址",
)
async def create_asset_upload_url(
    node_id: uuid.UUID,
    payload: MaterialAssetUploadUrlRequest,
    session: SessionDep,
    admin: AdminUser,
) -> MaterialAssetUploadUrlResponse:
    try:
        node_detail = await material_service.get_node_detail(session, node_id)
    except NodeNotFoundError as exc:
        raise not_found() from exc
    if node_detail.kind != "document":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="只能给文档上传图片",
        )
    try:
        ticket = await file_service.request_material_upload(
            session,
            user_id=admin.id,
            filename=payload.filename,
            size_bytes=payload.size_bytes,
        )
    except file_service.FileTooLargeError as exc:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="图片超过大小限制",
        ) from exc
    except file_service.UnsupportedFileTypeError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="仅支持图片",
        ) from exc
    await session.commit()
    return MaterialAssetUploadUrlResponse(
        file_id=ticket.file_id,
        upload_url=ticket.upload_url,
        headers=ticket.headers,
        expires_in=ticket.expires_in,
    )


@router.post(
    "/assets/{file_id}/complete",
    response_model=MaterialAssetCompleteResponse,
    summary="确认教材图片上传完成",
)
async def complete_asset_upload(
    file_id: uuid.UUID,
    session: SessionDep,
    admin: AdminUser,
) -> MaterialAssetCompleteResponse:
    try:
        file = await file_service.complete_material_upload(
            session,
            user_id=admin.id,
            file_id=file_id,
        )
    except file_service.AttachmentNotFoundError as exc:
        raise not_found() from exc
    except file_service.UploadIncompleteError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="上传未完成或文件大小不一致",
        ) from exc
    await session.commit()
    return MaterialAssetCompleteResponse(
        file_id=file.id,
        url=file_service.public_url(file),
        markdown=file_service.material_markdown(file),
    )
