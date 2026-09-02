"""Selección del backend de almacenamiento por configuración."""

from ruleta.config import Settings
from ruleta.repositories import InMemoryRouletteRepository, MongoRouletteRepository
from ruleta.storage import build_repository


def _settings(uri: str | None) -> Settings:
    return Settings(
        app_env="test",
        app_version="0.0.0",
        http_port=8000,
        allowed_origins=["*"],
        mongodb_uri=uri,
        mongodb_db="ruleta_test",
    )


def test_sin_uri_cae_a_memoria(caplog) -> None:
    with caplog.at_level("WARNING", logger="ruleta.storage"):
        repository = build_repository(_settings(None))
    assert isinstance(repository, InMemoryRouletteRepository)
    assert repository.backend == "memory"
    assert "MONGODB_URI" in caplog.text


def test_con_uri_usa_mongo() -> None:
    # Crear el cliente de motor no abre conexión: no hace falta un servidor.
    repository = build_repository(_settings("mongodb://localhost:27017"))
    assert isinstance(repository, MongoRouletteRepository)
    assert repository.backend == "mongo"
