from functools import lru_cache
from pathlib import Path

from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg2://postgres:123@localhost:5432/kassa_db"
    debug: bool = Field(default=True, env="DEBUG")

    jwt_secret_key: str = "kassa_project"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    refresh_token_expire_minutes: int = 60 * 24 * 7
    media_root: str = "app/static/uploads"
    vite_host: str | None = None
    vite_port: int | None = None
    sale_branch_name: str = "Магазин"

    environment: str = "dev"
    auto_run_migrations: bool = True
    autogenerate_migrations: bool | None = Field(default=False, env="AUTO_GENERATE_MIGRATIONS")
    admin_password: str = Field("admin", env="ADMIN_PASSWORD")

    cors_origins: str | None = Field(default=None, env="CORS_ORIGINS")
    cors_origin_regex: str | None = Field(default=None, env="CORS_ORIGIN_REGEX")

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def should_autogenerate_migrations(self) -> bool:
        return bool(self.autogenerate_migrations)

    @property
    def project_root(self) -> Path:
        return Path(__file__).resolve().parents[2]

    @property
    def media_root_path(self) -> Path:
        media_root = Path(self.media_root)
        if not media_root.is_absolute():
            media_root = self.project_root / media_root
        return media_root

    @property
    def allowed_cors_origins(self) -> List[str]:
        if self.cors_origins:
            origins = [origin.strip().rstrip("/") for origin in self.cors_origins.split(",")]
            return [origin for origin in origins if origin]

        return [
            "http://localhost:8080",
            "http://127.0.0.1:8080",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "https://samen.inbrain.kz",
        ]


    @property
    def allowed_cors_regex(self) -> str | None:
        return None



@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
