import logging
import uuid
from collections.abc import Sequence
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.infra.agent_client import get_agent_client
from app.api.repositories import session_repositories
from app.shared.dto.memory import (
    MemoryEntryDetailDTO,
    MemoryEntryDTO,
    MemoryEntryListDTO,
)

logger = logging.getLogger(__name__)


class InvalidMemoryResponseError(Exception):
    pass


async def list_entries(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    kind: Literal["daily", "digest"],
    limit: int,
    offset: int,
    date: str | None,
    session_id: uuid.UUID | None,
) -> MemoryEntryListDTO:
    try:
        response = await get_agent_client().list_memory_entries(
            user_id=str(user_id),
            kind=kind,
            limit=limit,
            offset=offset,
            date=date,
            session_id=str(session_id) if session_id is not None else None,
        )
    except ValueError as exc:
        logger.error("invalid memory list response: status=invalid_payload")
        raise InvalidMemoryResponseError from exc

    await _fill_session_titles(session, user_id, response.items)
    return response


async def get_entry(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    entry_id: str,
) -> MemoryEntryDetailDTO:
    try:
        detail = await get_agent_client().get_memory_entry(
            user_id=str(user_id),
            entry_id=entry_id,
        )
    except ValueError as exc:
        logger.error("invalid memory detail response: status=invalid_payload")
        raise InvalidMemoryResponseError from exc

    await _fill_session_titles(session, user_id, [detail])
    return detail


async def _fill_session_titles(
    session: AsyncSession,
    user_id: uuid.UUID,
    items: Sequence[MemoryEntryDTO | MemoryEntryDetailDTO],
) -> None:
    session_ids = {item.session_id for item in items if item.session_id is not None}
    if not session_ids:
        return

    titles = await session_repositories.get_titles(
        session,
        user_id=user_id,
        session_ids=session_ids,
    )

    for item in items:
        if item.session_id is not None:
            item.session_title = titles.get(item.session_id)
