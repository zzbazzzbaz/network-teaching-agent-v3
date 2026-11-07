from typing import Any, Protocol

TEXTBOOK_KB_TOP_K = 5
TEXTBOOK_KB_SCORE_THRESHOLD: float | None = None


class TextbookKnowledgeSettings(Protocol):
    textbook_kb_id: str | None


def build_knowledge_config(settings: TextbookKnowledgeSettings) -> dict[str, Any] | None:
    if not settings.textbook_kb_id:
        return None
    return {
        "knowledge_base_ids": [settings.textbook_kb_id],
        "parameters": {
            "mode": "agentic",
            "top_k": TEXTBOOK_KB_TOP_K,
            "score_threshold": TEXTBOOK_KB_SCORE_THRESHOLD,
        },
    }
