from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr, field_validator
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


class Settings(_Base):
    llm: LLMSettings = Field(default_factory=LLMSettings)
    redis: RedisSettings = Field(default_factory=RedisSettings)
    db: DBSettings = Field(default_factory=DBSettings)
    cos: COSSettings = Field(default_factory=COSSettings)
    jwt: JWTSettings = Field(default_factory=JWTSettings)

    agent_base_url: str
    api_base_url: str
    data_root: Path
    qdrant_url: str
    max_upload_bytes: int

    @field_validator("data_root")
    @classmethod
    def _require_absolute_data_root(cls, value: Path) -> Path:
        """相对路径会随启动 cwd 漂移, 直接拒绝。"""
        if not value.is_absolute():
            raise ValueError("必须是绝对路径")
        return value.resolve()

    @property
    def workspaces_dir(self) -> Path:
        return self.data_root / "workspaces"

    @property
    def memory_dir(self) -> Path:
        return self.data_root / "memory" / "reme"

    @property
    def kb_blobs_dir(self) -> Path:
        return self.data_root / "blobs"


@lru_cache
def get_settings() -> Settings:
    return Settings()
