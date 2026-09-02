"""Punto de entrada de la aplicación FastAPI."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import register_exception_handlers, router
from .config import get_settings
from .repositories import RouletteRepository
from .storage import build_repository

API_PREFIX = "/api/v1"

logger = logging.getLogger("ruleta")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Índices y conexiones se preparan una vez aquí, no en cada petición.
    repository: RouletteRepository = app.state.repository
    await repository.startup()
    logger.info("Almacenamiento en uso: %s", repository.backend)
    try:
        yield
    finally:
        await repository.shutdown()


def create_app(repository: RouletteRepository | None = None) -> FastAPI:
    """Crea la app; `repository` permite inyectar otro almacén en los tests."""
    settings = get_settings()
    app = FastAPI(
        title="La Ruleta",
        version=settings.app_version,
        docs_url=f"{API_PREFIX}/docs",
        openapi_url=f"{API_PREFIX}/openapi.json",
        lifespan=lifespan,
    )
    app.state.repository = repository if repository is not None else build_repository(settings)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)
    app.include_router(router, prefix=API_PREFIX)
    return app


app = create_app()


def run() -> None:
    settings = get_settings()
    uvicorn.run(app, host="0.0.0.0", port=settings.http_port)


if __name__ == "__main__":
    run()
