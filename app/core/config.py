from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class _Base(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


class LLMSettings(_Base):
    model_config = SettingsConfigDict(env_prefix="LLM_")
    api_key: str
    base_url: str
    model: str


class RedisSettings(_Base):
    model_config = SettingsConfigDict(env_prefix="REDIS_")

    host: str
    port: int
    password: str | None = None


class DBSettings(_Base):
    model_config = SettingsConfigDict(env_prefix="DB_")

    url: str
    database: str
    username: str
    password: str


class COSSettings(_Base):
    model_config = SettingsConfigDict(env_prefix="COS_")

    secret_id: str
    secret_key: str
    region: str
    bucket: str


class JWTSettings(_Base):
    model_config = SettingsConfigDict(env_prefix="JWT_")

    secret_key: str


class Settings(_Base):
    llm: LLMSettings = Field(default_factory=LLMSettings)
    redis: RedisSettings = Field(default_factory=RedisSettings)
    db: DBSettings = Field(default_factory=DBSettings)
    cos: COSSettings = Field(default_factory=COSSettings)
    jwt: JWTSettings = Field(default_factory=JWTSettings)

    agent_base_url: str
    api_base_url: str
    data_root: str

    @property
    def files_dir(self) -> Path:
        return Path(self.data_root) / "files"

    @property
    def workspaces_dir(self) -> Path:
        return Path(self.data_root) / "workspaces"


@lru_cache
def get_settings() -> Settings:
    return Settings()
