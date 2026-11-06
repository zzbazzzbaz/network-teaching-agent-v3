import logging
import uuid
from datetime import date as Date
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi import Path as PathParam

from app.api.dependencies import CurrentUser, SessionDep
from app.api.services import memory_service
from app.shared.dto.memory import MemoryEntryDetailDTO, MemoryEntryListDTO
from app.shared.errors import (
    RemoteServiceError,
    bad_request,
    memory_unavailable,
    not_found,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/memory", tags=["记忆"])


def _agent_failure(exc: RemoteServiceError) -> HTTPException:
    if exc.status_code == 404:
        return not_found()
    if exc.status_code in (400, 422):
        return bad_request()
    return memory_unavailable()


@router.get(
    "/entries",
    response_model=MemoryEntryListDTO,
    summary="记忆列表",
)
async def list_memory_entries(
    session: SessionDep,
    current_user: CurrentUser,
    kind: Annotated[Literal["daily", "digest"], Query()] = "daily",
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    date: Annotated[str | None, Query(pattern=r"^\d{4}-\d{2}-\d{2}$")] = None,
    session_id: uuid.UUID | None = None,
) -> MemoryEntryListDTO:
    if date is not None:
        try:
            Date.fromisoformat(date)
        except ValueError as exc:
            raise bad_request() from exc

    try:
        return await memory_service.list_entries(
            session,
            user_id=current_user.id,
            kind=kind,
            limit=limit,
            offset=offset,
            date=date,
            session_id=session_id,
        )
    except memory_service.InvalidMemoryResponseError as exc:
        raise memory_unavailable() from exc
    except RemoteServiceError as exc:
        logger.warning(
            "agent memory list failed: user_id=%s status=%s detail=%s",
            current_user.id,
            exc.status_code,
            exc.detail,
        )
        raise _agent_failure(exc) from exc


@router.get(
    "/entries/{entry_id}",
    response_model=MemoryEntryDetailDTO,
    summary="记忆详情",
)
async def get_memory_entry(
    entry_id: Annotated[str, PathParam(max_length=512)],
    session: SessionDep,
    current_user: CurrentUser,
) -> MemoryEntryDetailDTO:
    try:
        return await memory_service.get_entry(
            session,
            user_id=current_user.id,
            entry_id=entry_id,
        )
    except memory_service.InvalidMemoryResponseError as exc:
        raise memory_unavailable() from exc
    except RemoteServiceError as exc:
        logger.warning(
            "agent memory detail failed: user_id=%s status=%s detail=%s",
            current_user.id,
            exc.status_code,
            exc.detail,
        )
        raise _agent_failure(exc) from exc
