import uuid
from pathlib import Path

MATERIALS_PREFIX = "public/materials"
SESSIONS_PREFIX = "public/sessions"
KNOWLEDGE_PREFIX = "private/knowledge"
KNOWLEDGE_TEMP_PREFIX = "tmp/knowledge"

PUBLIC_CACHE_CONTROL = "public, max-age=31536000, immutable"


def safe_suffix(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    if len(suffix) <= 1 or len(suffix) > 10 or not suffix[1:].isalnum():
        return ""
    return suffix


def material_key(file_id: uuid.UUID, filename: str) -> str:
    return f"{MATERIALS_PREFIX}/{file_id}{safe_suffix(filename)}"


def session_key(session_id: uuid.UUID, file_id: uuid.UUID, filename: str) -> str:
    return f"{SESSIONS_PREFIX}/{session_id}/{file_id}{safe_suffix(filename)}"


def _segment(value: str) -> str:
    if not value or value in {".", ".."} or "/" in value or "\\" in value:
        raise ValueError("invalid storage key segment")
    return value


def knowledge_key(knowledge_base_id: str, document_id: str) -> str:
    return f"{KNOWLEDGE_PREFIX}/{_segment(knowledge_base_id)}/{_segment(document_id)}"


def knowledge_temp_key(user_id: str, upload_id: str) -> str:
    return f"{KNOWLEDGE_TEMP_PREFIX}/{_segment(user_id)}/{_segment(upload_id)}"
