import logging

from opentelemetry import trace
from opentelemetry.context import Context
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import ReadableSpan, Span, SpanProcessor, TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from app.shared.config import TracingSettings

logger = logging.getLogger(__name__)

_provider: TracerProvider | None = None


class TracingAttributeProcessor(SpanProcessor):
    def on_start(self, span: Span, parent_context: Context | None = None) -> None:
        conversation_id = (span.attributes or {}).get("gen_ai.conversation.id")
        if conversation_id:
            span.set_attribute("session.id", conversation_id)

        parent = trace.get_current_span(parent_context)
        if isinstance(parent, ReadableSpan):
            user_id = (parent.attributes or {}).get("user.id")
            if user_id:
                span.set_attribute("user.id", user_id)

    def on_end(self, span: ReadableSpan) -> None:
        pass


def _parse_headers(raw: str | None) -> dict[str, str]:
    if not raw:
        return {}
    headers: dict[str, str] = {}
    for item in raw.split(","):
        key, separator, value = item.partition("=")
        if separator and key.strip():
            headers[key.strip()] = value.strip()
    return headers


def _traces_endpoint(base_url: str) -> str:
    base = base_url.rstrip("/")
    if base.endswith("/v1/traces"):
        return base
    return f"{base}/v1/traces"


def setup_tracing(settings: TracingSettings) -> None:
    global _provider

    if not settings.enabled:
        return
    if not settings.exporter_otlp_endpoint:
        logger.warning("tracing 已启用但未配置 OTEL_EXPORTER_OTLP_ENDPOINT")
        return
    if _provider is not None:
        return
    if isinstance(trace.get_tracer_provider(), TracerProvider):
        logger.info("tracer provider 已存在, 跳过 tracing 初始化")
        return

    endpoint = _traces_endpoint(settings.exporter_otlp_endpoint)
    _provider = TracerProvider(
        resource=Resource.create({SERVICE_NAME: settings.service_name}),
    )
    _provider.add_span_processor(TracingAttributeProcessor())
    _provider.add_span_processor(
        BatchSpanProcessor(
            OTLPSpanExporter(
                endpoint=endpoint,
                headers=_parse_headers(settings.exporter_otlp_headers),
            ),
        ),
    )
    trace.set_tracer_provider(_provider)
    logger.info("tracing enabled: %s", endpoint)
