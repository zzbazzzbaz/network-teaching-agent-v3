from collections.abc import AsyncGenerator, Sequence
from typing import Any, cast
from unittest.mock import AsyncMock, MagicMock

import pytest
from agentscope.credential import DashScopeCredential, DeepSeekCredential
from agentscope.embedding import DashScopeEmbeddingModel, EmbeddingResponse, EmbeddingUsage
from agentscope.message import TextBlock, UserMsg
from agentscope.model import ChatResponse, ChatUsage
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import ReadableSpan, TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor, SpanExporter, SpanExportResult
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from app.agent.runtime.observability import (
    MeteredChatModel,
    MeteredEmbeddingModel,
    TracingUserMiddleware,
    UsageCategory,
    _CacheUsageSpanExporter,
    _TraceContextSpanProcessor,
)


class CapturingExporter(SpanExporter):
    def __init__(self) -> None:
        self.spans: list[ReadableSpan] = []

    def export(self, spans: Sequence[ReadableSpan]) -> SpanExportResult:
        self.spans.extend(spans)
        return SpanExportResult.SUCCESS

    def shutdown(self) -> None:
        pass

    def force_flush(self, timeout_millis: int = 30000) -> bool:
        return timeout_millis >= 0


async def _empty_stream() -> AsyncGenerator[Any]:
    if False:
        yield None


def test_cache_usage_exporter_adds_gen_ai_attributes() -> None:
    downstream = CapturingExporter()
    exporter = _CacheUsageSpanExporter(downstream)
    span = ReadableSpan(
        name="chat deepseek-flash",
        resource=Resource.create({}),
        attributes={
            "gen_ai.usage.input_tokens": 800,
            "agentscope.usage.cache_input_tokens": 200,
            "agentscope.usage.cache_creation_input_tokens": 10,
        },
        start_time=1,
        end_time=2,
    )

    exporter.export([span])

    exported = downstream.spans[0]
    assert exported.attributes is not None
    assert exported.attributes["gen_ai.usage.cache_read_input_tokens"] == 200
    assert exported.attributes["gen_ai.usage.cache_creation_input_tokens"] == 10
    assert exported.attributes["gen_ai.usage.input_tokens"] == 800


def test_cache_usage_exporter_keeps_span_without_cache() -> None:
    downstream = CapturingExporter()
    exporter = _CacheUsageSpanExporter(downstream)
    span = ReadableSpan(
        name="chat deepseek-flash",
        resource=Resource.create({}),
        attributes={"gen_ai.usage.input_tokens": 800},
        start_time=1,
        end_time=2,
    )

    exporter.export([span])

    assert downstream.spans[0] is span


def test_trace_context_processor_propagates_attributes() -> None:
    exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(_TraceContextSpanProcessor())
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    tracer = provider.get_tracer("test")

    with (
        tracer.start_as_current_span(
            "parent",
            attributes={
                "user.id": "student-1",
                "langfuse.trace.tags": ["chat"],
                "langfuse.trace.metadata.usage_category": "chat",
            },
        ),
        tracer.start_as_current_span("child"),
    ):
        pass

    child = next(span for span in exporter.get_finished_spans() if span.name == "child")
    assert child.attributes is not None
    assert child.attributes["user.id"] == "student-1"
    assert child.attributes["langfuse.trace.tags"] == ("chat",)
    assert child.attributes["langfuse.trace.metadata.usage_category"] == "chat"


@pytest.mark.asyncio
async def test_metered_chat_model_records_usage() -> None:
    exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    model = MeteredChatModel(
        credential=DeepSeekCredential(api_key="test"),
        model="deepseek-flash",
        stream=False,
        category=UsageCategory.REME_CHAT,
        user_id="student-1",
        tracer=provider.get_tracer("test"),
    )
    model._call_api = AsyncMock(
        return_value=ChatResponse(
            content=[TextBlock(text="ok")],
            is_last=True,
            usage=ChatUsage(
                input_tokens=800,
                output_tokens=100,
                time=0.1,
                cache_input_tokens=200,
            ),
        ),
    )

    response = await model([UserMsg("user", "hello")])

    assert isinstance(response, ChatResponse)
    span = exporter.get_finished_spans()[0]
    assert span.attributes is not None
    assert span.name == "reme chat deepseek-flash"
    assert span.attributes["gen_ai.operation.name"] == "chat"
    assert span.attributes["gen_ai.request.model"] == "deepseek-flash"
    assert span.attributes["gen_ai.usage.input_tokens"] == 800
    assert span.attributes["gen_ai.usage.output_tokens"] == 100
    assert span.attributes["gen_ai.usage.cache_read_input_tokens"] == 200
    assert span.attributes["user.id"] == "student-1"
    assert span.attributes["langfuse.trace.tags"] == ("reme-chat",)
    assert span.attributes["langfuse.trace.metadata.usage_category"] == "reme_chat"


@pytest.mark.asyncio
async def test_metered_chat_model_records_stream_usage() -> None:
    exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    model = MeteredChatModel(
        credential=DeepSeekCredential(api_key="test"),
        model="deepseek-flash",
        stream=True,
        category=UsageCategory.REME_CHAT,
        tracer=provider.get_tracer("test"),
    )

    async def stream() -> AsyncGenerator[ChatResponse]:
        yield ChatResponse(content=[TextBlock(text="o")], is_last=False)
        yield ChatResponse(
            content=[],
            is_last=True,
            usage=ChatUsage(
                input_tokens=100,
                output_tokens=20,
                time=0.1,
                cache_input_tokens=40,
            ),
        )

    model._call_api = AsyncMock(return_value=stream())

    result = await model([UserMsg("user", "hello")])
    chunks = [chunk async for chunk in cast(AsyncGenerator[ChatResponse], result)]

    assert len(chunks) == 2
    span = exporter.get_finished_spans()[0]
    assert span.attributes is not None
    assert span.attributes["gen_ai.usage.input_tokens"] == 100
    assert span.attributes["gen_ai.usage.output_tokens"] == 20
    assert span.attributes["gen_ai.usage.cache_read_input_tokens"] == 40


@pytest.mark.asyncio
async def test_metered_embedding_model_records_usage() -> None:
    exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    base_model = DashScopeEmbeddingModel(
        credential=DashScopeCredential(api_key="test"),
        model="text-embedding-v4",
        dimensions=1024,
    )
    base_model._call_api = AsyncMock(
        return_value=EmbeddingResponse(
            embeddings=[],
            usage=EmbeddingUsage(tokens=123, time=0.1),
        ),
    )
    model = MeteredEmbeddingModel(
        base_model,
        category=UsageCategory.REME_EMBEDDING,
        user_id="student-1",
        tracer=provider.get_tracer("test"),
    )

    response = await model(["hello"])

    assert response.usage is not None
    span = exporter.get_finished_spans()[0]
    assert span.attributes is not None
    assert span.name == "reme embedding text-embedding-v4"
    assert span.attributes["gen_ai.operation.name"] == "embeddings"
    assert span.attributes["gen_ai.request.model"] == "text-embedding-v4"
    assert span.attributes["gen_ai.usage.input_tokens"] == 123
    assert span.attributes["user.id"] == "student-1"
    assert span.attributes["langfuse.trace.tags"] == ("reme-embedding",)
    assert span.attributes["langfuse.trace.metadata.usage_category"] == "reme_embedding"


@pytest.mark.asyncio
async def test_metered_embedding_model_uses_custom_label() -> None:
    exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    base_model = DashScopeEmbeddingModel(
        credential=DashScopeCredential(api_key="test"),
        model="text-embedding-v4",
        dimensions=1024,
    )
    base_model._call_api = AsyncMock(
        return_value=EmbeddingResponse(
            embeddings=[],
            usage=EmbeddingUsage(tokens=500, time=0.1),
        ),
    )
    model = MeteredEmbeddingModel(
        base_model,
        category=UsageCategory.KNOWLEDGE_EMBEDDING,
        tracer=provider.get_tracer("test"),
    )

    await model(["hello"])

    span = exporter.get_finished_spans()[0]
    assert span.attributes is not None
    assert span.name == "knowledge embedding text-embedding-v4"
    assert span.attributes["gen_ai.usage.input_tokens"] == 500
    assert span.attributes["langfuse.trace.tags"] == ("knowledge-embedding",)
    assert span.attributes["langfuse.trace.metadata.usage_category"] == "knowledge_embedding"


@pytest.mark.asyncio
async def test_tracing_user_middleware_tags_current_span() -> None:
    exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    tracer = provider.get_tracer("test")
    middleware = TracingUserMiddleware("student-1")
    handler = MagicMock(return_value=_empty_stream())

    with tracer.start_as_current_span("reply"):
        async for _ in middleware.on_reply(cast(Any, None), {}, handler):
            pass

    span = exporter.get_finished_spans()[0]
    assert span.attributes is not None
    assert span.attributes["user.id"] == "student-1"
    assert span.attributes["langfuse.trace.tags"] == ("chat",)
    assert span.attributes["langfuse.trace.metadata.usage_category"] == "chat"
