import base64
import logging

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from app.shared.config import LangfuseSettings

logger = logging.getLogger(__name__)

_provider: TracerProvider | None = None


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
        logger.info("tracer provider 已存在, 跳过 tracing 初始化")
        return

    endpoint = _endpoint(settings)
    _provider = TracerProvider(
        resource=Resource.create({SERVICE_NAME: settings.service_name}),
    )
    _provider.add_span_processor(
        BatchSpanProcessor(
            OTLPSpanExporter(endpoint=endpoint, headers=_headers(settings)),
        ),
    )
    trace.set_tracer_provider(_provider)
    logger.info("tracing enabled: %s", endpoint)
