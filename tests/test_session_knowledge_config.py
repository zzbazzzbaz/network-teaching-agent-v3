from dataclasses import dataclass

from app.api.services.knowledge_config import build_knowledge_config


@dataclass
class FakeSettings:
    textbook_kb_id: str | None
    textbook_kb_top_k: int
    textbook_kb_score_threshold: float | None


def test_knowledge_config_payload() -> None:
    settings = FakeSettings(
        textbook_kb_id="kb-1",
        textbook_kb_top_k=4,
        textbook_kb_score_threshold=0.35,
    )

    assert build_knowledge_config(settings) == {
        "knowledge_base_ids": ["kb-1"],
        "parameters": {
            "mode": "agentic",
            "top_k": 4,
            "score_threshold": 0.35,
        },
    }


def test_knowledge_config_without_kb() -> None:
    settings = FakeSettings(
        textbook_kb_id=None,
        textbook_kb_top_k=5,
        textbook_kb_score_threshold=None,
    )

    assert build_knowledge_config(settings) is None
