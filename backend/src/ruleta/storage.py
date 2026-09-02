"""Selección del almacenamiento según la configuración."""

import logging

from motor.motor_asyncio import AsyncIOMotorClient

from .config import Settings
from .repositories import InMemoryRouletteRepository, MongoRouletteRepository, RouletteRepository

logger = logging.getLogger("ruleta.storage")


def build_repository(settings: Settings) -> RouletteRepository:
    """Devuelve el repositorio Mongo si hay `MONGODB_URI`; si no, el de memoria."""
    if settings.mongodb_uri is None:
        logger.warning(
            "MONGODB_URI no está definida: se usa el almacenamiento en memoria, "
            "los datos se pierden al reiniciar el proceso"
        )
        return InMemoryRouletteRepository()

    # tz_aware para que los instantes vuelvan de BSON con zona UTC explícita.
    client = AsyncIOMotorClient(settings.mongodb_uri, tz_aware=True)
    logger.info("Almacenamiento MongoDB en la base '%s'", settings.mongodb_db)
    return MongoRouletteRepository(client, settings.mongodb_db)
