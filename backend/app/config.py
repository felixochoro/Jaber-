from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # DB
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/schoolconnect"
    sync_database_url: str = "postgresql://postgres:postgres@localhost:5432/schoolconnect"

    # Redis
    redis_url: str = "redis://localhost:6379/0"
    cache_ttl_seconds: int = 300  # 5 minutes default

    # Security
    secret_key: str = "changeme"
    api_keys: str = "dev-key-1234"  # comma-separated

    # CORS
    cors_origins: str = "http://localhost:3000"

    # Rate limiting
    rate_limit_per_minute: int = 60

    # App
    environment: str = "development"
    log_level: str = "info"
    app_version: str = "1.0.0"

    @property
    def api_keys_list(self) -> List[str]:
        return [k.strip() for k in self.api_keys.split(",") if k.strip()]

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
