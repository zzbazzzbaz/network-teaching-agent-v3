import base64
import logging
from collections.abc import AsyncGenerator, Callable, Sequence
from enum import StrEnum
from typing import Any

from agentscope.agent import Agent
from agentscope.embedding import EmbeddingModelBase, EmbeddingResponse
from agentscope.message import DataBlock, Msg, TextBlock
from agentscope.middleware import MiddlewareBase
from agentscope.model import (
    ChatResponse,
    ChatUsage,
    DeepSeekChatModel,
    StructuredResponse,
)
from agentscope.tool import ToolChoice
from opentelemetry import trace
from opentelemetry.context import Context
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import ReadableSpan, Span, SpanProcessor, TracerProvider
from opentelemetry.sdk.trace.export import (
    BatchSpanProcessor,
    SpanExporter,
    SpanExportResult,
)
from opentelemetry.trace import Status, StatusCode, Tracer
from pydantic import BaseModel

from app.shared.config import LangfuseSettings

_logger = logging.getLogger(__name__)

_provider: TracerProvider | None = None

_PROPAGATED_ATTRIBUTES = (
    "user.id",
    "langfuse.trace.tags",
    "langfuse.trace.metadata.usage_category",
)


class UsageCategory(StrEnum):
    CHAT = "chat"
    REME_CHAT = "reme_chat"
    REME_EMBEDDING = "reme_embedding"
    KNOWLEDGE_EMBEDDING = "knowledge_embedding"

    @property
    def _tag(self) -> str:
        return self.value.replace("_", "-")

    @property
    def _label(self) -> str:
        if self is UsageCategory.KNOWLEDGE_EMBEDDING:
            return "knowledge"
        if self is UsageCategory.CHAT:
            return "chat"
        return "reme"


def _span_attributes(
    *,
    category: UsageCategory,
    operation: str,
    model: str,
    provider: str,
    user_id: str | None,
) -> dict[str, Any]:
    attributes: dict[str, Any] = {
        "gen_ai.operation.name": operation,
        "gen_ai.request.model": model,
        "gen_ai.provider.name": provider,
        "langfuse.trace.name": f"{category._label} {operation} {model}",
        "langfuse.trace.tags": [category._tag],
        "langfuse.trace.metadata.usage_category": category.value,
    }
    if user_id:
        attributes["user.id"] = user_id
    return attributes


def _set_chat_usage(span: trace.Span, usage: ChatUsage | None) -> None:
    if usage is None:
        return
    span.set_attribute("gen_ai.usage.input_tokens", usage.input_tokens)
    span.set_attribute("gen_ai.usage.output_tokens", usage.output_tokens)
    if usage.cache_input_tokens:
        span.set_attribute(
            "gen_ai.usage.cache_read_input_tokens",
            usage.cache_input_tokens,
        )
    if usage.cache_creation_input_tokens:
        span.set_attribute(
            "gen_ai.usage.cache_creation_input_tokens",
            usage.cache_creation_input_tokens,
        )


def _end_with_error(span: trace.Span, exc: BaseException) -> None:
    span.record_exception(exc)
    span.set_status(Status(StatusCode.ERROR, str(exc)))
    span.end()


class MeteredChatModel(DeepSeekChatModel):
    def __init__(
        self,
        *,
        category: UsageCategory = UsageCategory.REME_CHAT,
        user_id: str | None = None,
        tracer: Tracer | None = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        self._category = category
        self._user_id = user_id
        self._tracer = tracer or trace.get_tracer("app.llm")

    def _start_span(self) -> trace.Span:
        return self._tracer.start_span(
            name=f"{self._category._label} chat {self.model}",
            context=Context(),
            attributes=_span_attributes(
                category=self._category,
                operation="chat",
                model=self.model,
                provider="deepseek",
                user_id=self._user_id,
            ),
        )

    async def __call__(
        self,
        messages: list[Msg],
        tools: list[dict] | None = None,
        tool_choice: ToolChoice | None = None,
        **kwargs: Any,
    ) -> ChatResponse | AsyncGenerator[ChatResponse]:
        span = self._start_span()
        try:
            result = await super().__call__(
                messages,
                tools=tools,
                tool_choice=tool_choice,
                **kwargs,
            )
        except BaseException as exc:
            if isinstance(exc, Exception):
                _end_with_error(span, exc)
            else:
                span.end()
            raise

        if isinstance(result, ChatResponse):
            _set_chat_usage(span, result.usage)
            span.end()
            return result

        return self._stream(result, span)

    async def _stream(
        self,
        stream: AsyncGenerator[ChatResponse],
        span: trace.Span,
    ) -> AsyncGenerator[ChatResponse]:
        usage: ChatUsage | None = None
        failed = False
        try:
            async for chunk in stream:
                if chunk.is_last and chunk.usage is not None:
                    usage = chunk.usage
                yield chunk
        except BaseException as exc:
            failed = True
            if isinstance(exc, Exception):
                _end_with_error(span, exc)
            else:
                span.end()
            raise
        finally:
            if not failed:
                _set_chat_usage(span, usage)
                span.end()

    async def generate_structured_output(
        self,
        messages: list[Msg],
        structured_model: type[BaseModel] | dict,
        **kwargs: Any,
    ) -> StructuredResponse:
        span = self._start_span()
        try:
            result = await super().generate_structured_output(
                messages,
                structured_model,
                **kwargs,
            )
        except BaseException as exc:
            if isinstance(exc, Exception):
                _end_with_error(span, exc)
            else:
                span.end()
            raise
        _set_chat_usage(span, result.usage)
        span.end()
        return result


class MeteredEmbeddingModel(EmbeddingModelBase):
    def __init__(
        self,
        model: EmbeddingModelBase,
        *,
        category: UsageCategory = UsageCategory.REME_EMBEDDING,
        user_id: str | None = None,
        tracer: Tracer | None = None,
    ) -> None:
        self._model = model
        self._category = category
        self._user_id = user_id
        self._tracer = tracer or trace.get_tracer("app.llm")

    def __getattr__(self, name: str) -> Any:
        return getattr(self._model, name)

    def _start_span(self) -> trace.Span:
        return self._tracer.start_span(
            name=f"{self._category._label} embedding {self.model}",
            context=Context(),
            attributes=_span_attributes(
                category=self._category,
                operation="embeddings",
                model=self.model,
                provider="dashscope",
                user_id=self._user_id,
            ),
        )

    async def __call__(
        self,
        inputs: list[str | TextBlock | DataBlock],
        **kwargs: Any,
    ) -> EmbeddingResponse:
        span = self._start_span()
        try:
            response = await self._model(inputs, **kwargs)
        except BaseException as exc:
            if isinstance(exc, Exception):
                _end_with_error(span, exc)
            else:
                span.end()
            raise

        if response.usage is not None and response.usage.tokens:
            span.set_attribute("gen_ai.usage.input_tokens", response.usage.tokens)
        span.end()
        return response

    async def _call_api(
        self,
        inputs: list[Any],
        **kwargs: Any,
    ) -> EmbeddingResponse:
        return await self._model._call_api(inputs, **kwargs)


class TracingUserMiddleware(MiddlewareBase):
    def __init__(self, user_id: str) -> None:
        self._user_id = user_id

    async def on_reply(
        self,
        agent: Agent,
        input_kwargs: dict,
        next_handler: Callable[..., AsyncGenerator],
    ) -> AsyncGenerator:
        del agent
        span = trace.get_current_span()
        if span.is_recording():
            span.set_attribute("user.id", self._user_id)
            span.set_attribute(
                "langfuse.trace.tags",
                [UsageCategory.CHAT._tag],
            )
            span.set_attribute(
                "langfuse.trace.metadata.usage_category",
                UsageCategory.CHAT.value,
            )
        async for item in next_handler(**input_kwargs):
            yield item


class _TraceContextSpanProcessor(SpanProcessor):
    def on_start(self, span: Span, parent_context: Context | None = None) -> None:
        parent = trace.get_current_span(parent_context)
        if not isinstance(parent, ReadableSpan):
            return
        parent_attributes = parent.attributes or {}
        for key in _PROPAGATED_ATTRIBUTES:
            value = parent_attributes.get(key)
            if value:
                span.set_attribute(key, value)

    def on_end(self, span: ReadableSpan) -> None:
        pass


def _with_cache_usage(span: ReadableSpan) -> ReadableSpan:
    attributes = dict(span.attributes or {})
    cache_input = attributes.get("agentscope.usage.cache_input_tokens")
    cache_creation = attributes.get("agentscope.usage.cache_creation_input_tokens")
    if not cache_input and not cache_creation:
        return span
    if cache_input:
        attributes["gen_ai.usage.cache_read_input_tokens"] = cache_input
    if cache_creation:
        attributes["gen_ai.usage.cache_creation_input_tokens"] = cache_creation
    return ReadableSpan(
        name=span.name,
        context=span.context,
        parent=span.parent,
        resource=span.resource,
        attributes=attributes,
        events=span.events,
        links=span.links,
        kind=span.kind,
        status=span.status,
        start_time=span.start_time,
        end_time=span.end_time,
        instrumentation_scope=span.instrumentation_scope,
    )


class _CacheUsageSpanExporter(SpanExporter):
    def __init__(self, exporter: SpanExporter) -> None:
        self._exporter = exporter

    def export(self, spans: Sequence[ReadableSpan]) -> SpanExportResult:
        return self._exporter.export([_with_cache_usage(span) for span in spans])

    def shutdown(self) -> None:
        self._exporter.shutdown()

    def force_flush(self, timeout_millis: int = 30000) -> bool:
        return self._exporter.force_flush(timeout_millis)


def _endpoint(settings: LangfuseSettings) -> str:
    return f"{settings.base_url.rstrip('/')}/api/public/otel/v1/traces"


def _headers(settings: LangfuseSettings) -> dict[str, str]:
    public_key = settings.public_key.get_secret_value()
    secret_key = settings.secret_key.get_secret_value()
    token = base64.b64encode(f"{public_key}:{secret_key}".encode()).decode()
    return {
        "Authorization": f"Basic {token}",
        "x-langfuse-ingestion-version": "4",
    }


def setup_tracing(settings: LangfuseSettings) -> None:
    global _provider

    if not settings.enabled:
        return
    if _provider is not None:
        return
    if isinstance(trace.get_tracer_provider(), TracerProvider):
        _logger.info("tracer provider 已存在, 跳过 tracing 初始化")
        return

    endpoint = _endpoint(settings)
    _provider = TracerProvider(
        resource=Resource.create({SERVICE_NAME: settings.service_name}),
    )
    _provider.add_span_processor(_TraceContextSpanProcessor())
    _provider.add_span_processor(
        BatchSpanProcessor(
            _CacheUsageSpanExporter(
                OTLPSpanExporter(endpoint=endpoint, headers=_headers(settings)),
            ),
        ),
    )
    trace.set_tracer_provider(_provider)
    _logger.info("tracing enabled: %s", endpoint)
