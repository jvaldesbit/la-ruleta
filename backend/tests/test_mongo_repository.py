"""Tests de la implementación MongoDB.

Se saltan salvo que el entorno traiga `MONGODB_TEST_URI`; en CI hoy solo se
ejecutan los de memoria.
"""

import asyncio
import os
import uuid
from collections.abc import Awaitable, Callable
from decimal import Decimal
from typing import Any

import pytest
from bson import Decimal128
from fastapi.testclient import TestClient
from motor.motor_asyncio import AsyncIOMotorClient

from ruleta.api.dependencies import get_spinner
from ruleta.domain import (
    Bet,
    BetColor,
    InvalidRouletteStateError,
    Roulette,
    RouletteNotFoundError,
)
from ruleta.main import create_app
from ruleta.repositories import MongoRouletteRepository

MONGODB_TEST_URI = os.getenv("MONGODB_TEST_URI")

pytestmark = [
    pytest.mark.mongo,
    pytest.mark.skipif(
        not MONGODB_TEST_URI,
        reason="define MONGODB_TEST_URI para ejecutar los tests contra MongoDB",
    ),
]


def _database_name() -> str:
    return f"ruleta_test_{uuid.uuid4().hex[:8]}"


def run_with_repository[T](caso: Callable[[MongoRouletteRepository], Awaitable[T]]) -> T:
    """Ejecuta el caso con un repositorio sobre una base efímera que luego borra."""

    async def _main() -> T:
        database = _database_name()
        client = AsyncIOMotorClient(MONGODB_TEST_URI, tz_aware=True)
        repository = MongoRouletteRepository(client, database)
        await repository.startup()
        try:
            return await caso(repository)
        finally:
            await client.drop_database(database)
            client.close()

    return asyncio.run(_main())


@pytest.fixture
def mongo_client() -> Any:
    client = AsyncIOMotorClient(MONGODB_TEST_URI, tz_aware=True)
    yield client
    client.close()


def test_indices_creados_al_arrancar() -> None:
    async def caso(repository: MongoRouletteRepository) -> dict[str, Any]:
        return await repository._collection.index_information()

    indices = run_with_repository(caso)
    assert "status_idx" in indices
    assert "created_at_idx" in indices


def test_ciclo_completo_persistido() -> None:
    async def caso(repository: MongoRouletteRepository) -> Roulette:
        roulette = Roulette()
        await repository.add(roulette)
        assert (await repository.get(roulette.id)).status == "created"

        await repository.open(roulette.id)
        await repository.append_bet(
            roulette.id, Bet.on_number(roulette.id, "u1", 7, Decimal("100.00"))
        )
        await repository.append_bet(
            roulette.id, Bet.on_color(roulette.id, "u2", BetColor.BLACK, Decimal("50.00"))
        )
        cerrada = await repository.close(roulette.id, 7)
        assert len(await repository.list_all()) == 1
        return cerrada

    cerrada = run_with_repository(caso)
    assert cerrada.status == "closed"
    assert cerrada.winning_number == 7
    assert cerrada.winning_color is BetColor.BLACK
    assert [result.payout for result in cerrada.results] == [Decimal("500.00"), Decimal("90.00")]
    assert cerrada.total_amount_bet == Decimal("150.00")
    assert cerrada.opened_at is not None and cerrada.closed_at is not None


def test_montos_almacenados_como_decimal128() -> None:
    async def caso(repository: MongoRouletteRepository) -> dict[str, Any]:
        roulette = Roulette()
        await repository.add(roulette)
        await repository.open(roulette.id)
        await repository.append_bet(
            roulette.id, Bet.on_number(roulette.id, "u1", 3, Decimal("0.01"))
        )
        await repository.close(roulette.id, 3)
        return await repository._collection.find_one({"_id": roulette.id})

    doc = run_with_repository(caso)
    assert isinstance(doc["bets"][0]["amount"], Decimal128)
    assert doc["bets"][0]["amount"].to_decimal() == Decimal("0.01")
    assert doc["results"][0]["payout"].to_decimal() == Decimal("0.05")


def test_errores_de_estado_y_de_inexistencia() -> None:
    async def caso(repository: MongoRouletteRepository) -> None:
        with pytest.raises(RouletteNotFoundError):
            await repository.open("no-existe")
        with pytest.raises(RouletteNotFoundError):
            await repository.close("no-existe", 1)
        with pytest.raises(RouletteNotFoundError):
            await repository.append_bet("no-existe", Bet.on_number("x", "u1", 1, Decimal("1")))

        roulette = Roulette()
        await repository.add(roulette)
        with pytest.raises(InvalidRouletteStateError, match="No se puede apostar"):
            await repository.append_bet(
                roulette.id, Bet.on_number(roulette.id, "u1", 1, Decimal("1"))
            )
        with pytest.raises(InvalidRouletteStateError, match="no se puede cerrar"):
            await repository.close(roulette.id, 1)

        await repository.open(roulette.id)
        with pytest.raises(InvalidRouletteStateError, match="no se puede abrir"):
            await repository.open(roulette.id)

        await repository.close(roulette.id, 1)
        with pytest.raises(InvalidRouletteStateError, match="no se puede cerrar"):
            await repository.close(roulette.id, 1)
        with pytest.raises(InvalidRouletteStateError, match="No se puede apostar"):
            await repository.append_bet(
                roulette.id, Bet.on_number(roulette.id, "u1", 1, Decimal("1"))
            )

    run_with_repository(caso)


def test_aperturas_y_cierres_concurrentes_solo_dejan_ganar_a_uno() -> None:
    async def caso(repository: MongoRouletteRepository) -> None:
        roulette = Roulette()
        await repository.add(roulette)

        aperturas = await asyncio.gather(
            repository.open(roulette.id),
            repository.open(roulette.id),
            return_exceptions=True,
        )
        assert sum(isinstance(item, Roulette) for item in aperturas) == 1
        assert sum(isinstance(item, InvalidRouletteStateError) for item in aperturas) == 1

        await repository.append_bet(
            roulette.id, Bet.on_color(roulette.id, "u1", BetColor.RED, Decimal("10.00"))
        )
        cierres = await asyncio.gather(
            repository.close(roulette.id, 2),
            repository.close(roulette.id, 2),
            return_exceptions=True,
        )
        assert sum(isinstance(item, Roulette) for item in cierres) == 1
        assert sum(isinstance(item, InvalidRouletteStateError) for item in cierres) == 1

        final = await repository.get(roulette.id)
        assert len(final.results) == 1
        assert final.results[0].payout == Decimal("18.00")

    run_with_repository(caso)


def test_api_completa_contra_mongo() -> None:
    database = _database_name()
    client = AsyncIOMotorClient(MONGODB_TEST_URI, tz_aware=True)
    app = create_app(repository=MongoRouletteRepository(client, database))
    app.dependency_overrides[get_spinner] = lambda: lambda: 0
    try:
        with TestClient(app) as test_client:
            salud = test_client.get("/api/v1/health").json()
            assert salud == {"status": "ok", "version": salud["version"], "storage": "mongo"}

            roulette_id = test_client.post("/api/v1/roulettes").json()["id"]
            test_client.post(f"/api/v1/roulettes/{roulette_id}/open")
            test_client.post(
                f"/api/v1/roulettes/{roulette_id}/bets",
                json={"type": "color", "color": "red", "amount": 25.50},
                headers={"X-User-Id": "u1"},
            )
            cierre = test_client.post(f"/api/v1/roulettes/{roulette_id}/close").json()
            assert cierre["winning_number"] == 0
            assert cierre["winning_color"] == "red"
            assert cierre["results"][0]["payout"] == 45.9
            assert cierre["total_amount_bet"] == 25.5

            detalle = test_client.get(f"/api/v1/roulettes/{roulette_id}").json()
            assert detalle["status"] == "closed"
            assert detalle["bets_count"] == 1
            assert len(test_client.get("/api/v1/roulettes").json()) == 1
    finally:
        limpieza = AsyncIOMotorClient(MONGODB_TEST_URI)
        asyncio.run(_drop(limpieza, database))


async def _drop(client: AsyncIOMotorClient, database: str) -> None:
    try:
        await client.drop_database(database)
    finally:
        client.close()
