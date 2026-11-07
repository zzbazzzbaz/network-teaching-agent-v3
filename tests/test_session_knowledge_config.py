from dataclasses import dataclass

from app.api.services.knowledge_config import build_knowledge_config


@dataclass
class FakeSettings:
    textbook_kb_id: str | None


def test_knowledge_config_payload() -> None:
    settings = FakeSettings(textbook_kb_id="kb-1")

    assert build_knowledge_config(settings) == {
        "knowledge_base_ids": ["kb-1"],
        "parameters": {
            "mode": "agentic",
            "top_k": 5,
            "score_threshold": None,
        },
    }


def test_knowledge_config_without_kb() -> None:
    settings = FakeSettings(textbook_kb_id=None)

    assert build_knowledge_config(settings) is None
