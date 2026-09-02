"""Configuración leída del entorno; no contiene secretos."""

import os
from dataclasses import dataclass
from functools import lru_cache

DEFAULT_PORT = 8000


@dataclass(frozen=True, slots=True)
class Settings:
    app_env: str
    app_version: str
    http_port: int
    allowed_origins: list[str]
    mongodb_uri: str | None
    mongodb_db: str


def _parse_origins(raw: str) -> list[str]:
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    return origins or ["*"]


@lru_cache
def get_settings() -> Settings:
    return Settings(
        app_env=os.getenv("APP_ENV", "development"),
        app_version=os.getenv("APP_VERSION", "0.1.0"),
        http_port=int(os.getenv("HTTP_PORT", str(DEFAULT_PORT))),
        allowed_origins=_parse_origins(os.getenv("ALLOWED_ORIGINS", "*")),
        # Sin MONGODB_URI la app arranca igual, con el almacén en memoria.
        mongodb_uri=os.getenv("MONGODB_URI") or None,
        mongodb_db=os.getenv("MONGODB_DB", "ruleta"),
    )
