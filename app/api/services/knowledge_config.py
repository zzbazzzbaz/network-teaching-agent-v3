from typing import Any, Protocol


class TextbookKnowledgeSettings(Protocol):
    textbook_kb_id: str | None
    textbook_kb_top_k: int
    textbook_kb_score_threshold: float | None


def build_knowledge_config(settings: TextbookKnowledgeSettings) -> dict[str, Any] | None:
    if not settings.textbook_kb_id:
        return None
    return {
        "knowledge_base_ids": [settings.textbook_kb_id],
        "parameters": {
            "mode": "agentic",
            "top_k": settings.textbook_kb_top_k,
            "score_threshold": settings.textbook_kb_score_threshold,
        },
    }
