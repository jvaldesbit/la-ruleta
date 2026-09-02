"""Piezas del adaptador Mongo que no necesitan un servidor."""

import asyncio
from decimal import Decimal

from bson import Decimal128
from fastapi.testclient import TestClient
from motor.motor_asyncio import AsyncIOMotorClient

from ruleta.domain import Bet, BetColor, Roulette
from ruleta.main import create_app
from ruleta.repositories import InMemoryRouletteRepository, MongoRouletteRepository
from ruleta.repositories.mongo import roulette_from_document, roulette_to_document


def _ruleta_cerrada() -> Roulette:
    roulette = Roulette()
    roulette.open()
    roulette.place_bet(Bet.on_number(roulette.id, "u1", 7, Decimal("100.00")))
    roulette.place_bet(Bet.on_color(roulette.id, "u2", BetColor.RED, Decimal("0.01")))
    roulette.close(7)
    return roulette


def test_los_montos_se_guardan_como_decimal128() -> None:
    doc = roulette_to_document(_ruleta_cerrada())
    assert all(isinstance(bet["amount"], Decimal128) for bet in doc["bets"])
    assert all(isinstance(result["payout"], Decimal128) for result in doc["results"])


def test_las_apuestas_van_embebidas_en_el_documento() -> None:
    doc = roulette_to_document(_ruleta_cerrada())
    assert doc["_id"]
    assert len(doc["bets"]) == 2
    assert {result["bet_id"] for result in doc["results"]} == {bet["_id"] for bet in doc["bets"]}


def test_ida_y_vuelta_conserva_el_estado_y_la_precision() -> None:
    original = _ruleta_cerrada()
    recuperada = roulette_from_document(roulette_to_document(original))

    assert recuperada.id == original.id
    assert recuperada.status is original.status
    assert recuperada.winning_number == 7
    assert recuperada.winning_color is original.winning_color
    assert recuperada.created_at == original.created_at
    assert recuperada.closed_at == original.closed_at
    assert [bet.amount for bet in recuperada.bets] == [Decimal("100.00"), Decimal("0.01")]
    assert [result.payout for result in recuperada.results] == [Decimal("500.00"), Decimal("0.00")]
    assert recuperada.total_amount_bet == original.total_amount_bet
    assert recuperada.results[0].bet is recuperada.bets[0]


def test_documento_sin_apuestas_ni_resultados() -> None:
    roulette = roulette_from_document(roulette_to_document(Roulette()))
    assert roulette.bets == []
    assert roulette.results == []
    assert roulette.winning_color is None


def test_ping_es_falso_si_mongo_no_responde() -> None:
    async def caso() -> tuple[bool, str]:
        # Puerto sin nadie escuchando: el ping debe fallar rápido, no explotar.
        client = AsyncIOMotorClient("mongodb://127.0.0.1:1", serverSelectionTimeoutMS=200)
        repository = MongoRouletteRepository(client, "ruleta_test")
        try:
            return await repository.ping(), repository.backend
        finally:
            client.close()

    alive, backend = asyncio.run(caso())
    assert alive is False
    assert backend == "mongo"


def test_health_reporta_degraded_si_el_almacenamiento_no_responde() -> None:
    with TestClient(create_app(repository=_RepositorioCaido())) as test_client:
        body = test_client.get("/api/v1/health").json()
    assert body["status"] == "degraded"
    assert body["storage"] == "mongo"


class _RepositorioCaido(InMemoryRouletteRepository):
    """Doble de prueba: se comporta como Mongo caído para el healthcheck."""

    backend = "mongo"

    async def ping(self) -> bool:
        return False
