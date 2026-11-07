from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class _Base(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


class LLMSettings(_Base):
    model_config = SettingsConfigDict(env_prefix="LLM_")
    api_key: SecretStr
    base_url: str
    chat_model: str
    embedding_model: str


class RedisSettings(_Base):
    model_config = SettingsConfigDict(env_prefix="REDIS_")

    host: str
    port: int
    password: str | None
    max_connections: int


class DBSettings(_Base):
    model_config = SettingsConfigDict(env_prefix="DB_")

    url: str


class COSSettings(_Base):
    model_config = SettingsConfigDict(env_prefix="COS_")

    secret_id: str
    secret_key: str
    region: str
    bucket: str
    upload_expires: int
    download_expires: int


class JWTSettings(_Base):
    model_config = SettingsConfigDict(env_prefix="JWT_")

    secret_key: str
    access_token_minutes: int
    refresh_token_days: int


class APISettings(_Base):
    model_config = SettingsConfigDict(env_prefix="API_")

    base_url: str


class AgentClientSettings(_Base):
    model_config = SettingsConfigDict(env_prefix="AGENT_")

    base_url: str
    http_max_connections: int
    http_max_keepalive_connections: int


class StorageSettings(_Base):
    data_root: Path
    materials_dir: Path
    max_upload_bytes: int

    @property
    def workspaces_dir(self) -> Path:
        return self.data_root / "workspaces"

    @property
    def memory_dir(self) -> Path:
        return self.data_root / "memory" / "reme"


class TracingSettings(_Base):
    model_config = SettingsConfigDict(env_prefix="OTEL_")

    enabled: bool = False
    exporter_otlp_endpoint: str | None
    exporter_otlp_headers: str | None
    service_name: str


class Settings(_Base):
    llm: LLMSettings = Field(default_factory=LLMSettings)
    redis: RedisSettings = Field(default_factory=RedisSettings)
    db: DBSettings = Field(default_factory=DBSettings)
    cos: COSSettings = Field(default_factory=COSSettings)
    jwt: JWTSettings = Field(default_factory=JWTSettings)
    api: APISettings = Field(default_factory=APISettings)
    agent_client: AgentClientSettings = Field(default_factory=AgentClientSettings)
    storage: StorageSettings = Field(default_factory=StorageSettings)
    tracing: TracingSettings = Field(default_factory=TracingSettings)


@lru_cache
def get_settings() -> Settings:
    return Settings()
