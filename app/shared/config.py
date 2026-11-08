from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class _Base(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


class ChatSettings(_Base):
    model_config = SettingsConfigDict(env_prefix="CHAT_")
    api_key: SecretStr
    base_url: str
    model: str


class EmbeddingSettings(_Base):
    model_config = SettingsConfigDict(env_prefix="EMBEDDING_")
    api_key: SecretStr
    base_url: str
    model: str


class RedisSettings(_Base):
    model_config = SettingsConfigDict(env_prefix="REDIS_")

    host: str
    port: int
    password: str | None
    max_connections: int


class DBSettings(_Base):
    model_config = SettingsConfigDict(env_prefix="DB_")

    url: str


class QdrantSettings(_Base):
    model_config = SettingsConfigDict(env_prefix="QDRANT_")

    url: str
    api_key: SecretStr | None


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
    knowledge_max_upload_bytes: int

    @property
    def workspaces_dir(self) -> Path:
        return self.data_root / "workspaces"

    @property
    def memory_dir(self) -> Path:
        return self.data_root / "memory" / "reme"

    @property
    def knowledge_blobs_dir(self) -> Path:
        return self.data_root / "knowledge" / "blobs"


class LangfuseSettings(_Base):
    model_config = SettingsConfigDict(env_prefix="LANGFUSE_")

    enabled: bool
    public_key: SecretStr
    secret_key: SecretStr
    base_url: str
    service_name: str


class Settings(_Base):
    chat: ChatSettings = Field(default_factory=ChatSettings)
    embedding: EmbeddingSettings = Field(default_factory=EmbeddingSettings)
    redis: RedisSettings = Field(default_factory=RedisSettings)
    db: DBSettings = Field(default_factory=DBSettings)
    qdrant: QdrantSettings = Field(default_factory=QdrantSettings)
    cos: COSSettings = Field(default_factory=COSSettings)
    jwt: JWTSettings = Field(default_factory=JWTSettings)
    api: APISettings = Field(default_factory=APISettings)
    agent_client: AgentClientSettings = Field(default_factory=AgentClientSettings)
    storage: StorageSettings = Field(default_factory=StorageSettings)
    langfuse: LangfuseSettings = Field(default_factory=LangfuseSettings)


@lru_cache
def get_settings() -> Settings:
    return Settings()
