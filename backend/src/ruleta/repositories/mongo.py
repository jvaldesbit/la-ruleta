"""Implementación del repositorio sobre MongoDB con motor."""

import logging
from collections.abc import Callable
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from bson import Decimal128
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection
from pymongo import ASCENDING, ReturnDocument
from pymongo.errors import PyMongoError

from ..domain import (
    Bet,
    BetColor,
    BetResult,
    BetType,
    InvalidRouletteStateError,
    Roulette,
    RouletteNotFoundError,
    RouletteStatus,
)

logger = logging.getLogger("ruleta.repositories.mongo")

COLLECTION_NAME = "roulettes"

# Reintentos del cierre optimista: solo se agotan si llegan apuestas nuevas
# entre la lectura y la escritura una y otra vez.
_MAX_CLOSE_ATTEMPTS = 5


def _to_decimal128(amount: Decimal) -> Decimal128:
    return Decimal128(amount)


def _to_decimal(value: Any) -> Decimal:
    return value.to_decimal() if isinstance(value, Decimal128) else Decimal(str(value))


def bet_to_document(bet: Bet) -> dict[str, Any]:
    return {
        "_id": bet.id,
        "user_id": bet.user_id,
        "type": str(bet.type),
        "number": bet.number,
        "color": str(bet.color) if bet.color is not None else None,
        # Decimal128 y no float: el dinero no admite el redondeo binario.
        "amount": _to_decimal128(bet.amount),
        "created_at": bet.created_at,
    }


def roulette_to_document(roulette: Roulette) -> dict[str, Any]:
    """Serializa la ruleta completa con sus apuestas embebidas.

    Las apuestas van embebidas y no en su propia colección porque siempre se
    leen y se liquidan junto con su ruleta, nunca por separado: así el cierre
    resuelve todo el periodo con una sola lectura y una sola escritura, sin
    joins ni transacciones entre colecciones.
    """
    return {
        "_id": roulette.id,
        "status": str(roulette.status),
        "created_at": roulette.created_at,
        "opened_at": roulette.opened_at,
        "closed_at": roulette.closed_at,
        "winning_number": roulette.winning_number,
        "bets": [bet_to_document(bet) for bet in roulette.bets],
        "results": [
            {"bet_id": result.bet.id, "won": result.won, "payout": _to_decimal128(result.payout)}
            for result in roulette.results
        ],
    }


def _bet_from_document(roulette_id: str, doc: dict[str, Any]) -> Bet:
    color = doc.get("color")
    return Bet(
        id=doc["_id"],
        roulette_id=roulette_id,
        user_id=doc["user_id"],
        type=BetType(doc["type"]),
        amount=_to_decimal(doc["amount"]),
        created_at=_as_utc(doc["created_at"]),
        number=doc.get("number"),
        color=BetColor(color) if color is not None else None,
    )


def _as_utc(value: datetime | None) -> Any:
    # BSON guarda los instantes en UTC; si el cliente no es tz_aware hay que
    # reponer la zona para no comparar naive contra aware más adelante.
    if value is None:
        return None
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def roulette_from_document(doc: dict[str, Any]) -> Roulette:
    roulette_id = doc["_id"]
    bets = [_bet_from_document(roulette_id, bet_doc) for bet_doc in doc.get("bets", [])]
    by_id = {bet.id: bet for bet in bets}
    results = [
        BetResult(
            bet=by_id[result["bet_id"]], won=result["won"], payout=_to_decimal(result["payout"])
        )
        for result in doc.get("results", [])
        if result["bet_id"] in by_id
    ]
    return Roulette(
        id=roulette_id,
        status=RouletteStatus(doc["status"]),
        created_at=_as_utc(doc["created_at"]),
        opened_at=_as_utc(doc.get("opened_at")),
        closed_at=_as_utc(doc.get("closed_at")),
        winning_number=doc.get("winning_number"),
        bets=bets,
        results=results,
    )


class MongoRouletteRepository:
    """Repositorio sobre una única colección `roulettes`.

    Las transiciones no usan lock: se hacen con actualizaciones condicionadas
    al estado esperado, de modo que dos peticiones concurrentes que abren o
    cierran la misma ruleta solo dejan ganar a una.
    """

    backend = "mongo"

    def __init__(self, client: AsyncIOMotorClient, database: str) -> None:
        self._client = client
        self._collection: AsyncIOMotorCollection = client[database][COLLECTION_NAME]

    async def startup(self) -> None:
        """Crea los índices una sola vez, al arrancar la app, nunca por petición.

        Si Mongo no está disponible el arranque no se aborta: la app queda en pie
        respondiendo 503 en `/health` hasta que la base vuelva, en vez de entrar
        en un ciclo de reinicios en el que nadie puede consultar su estado.
        """
        try:
            await self._collection.create_index([("status", ASCENDING)], name="status_idx")
            await self._collection.create_index([("created_at", ASCENDING)], name="created_at_idx")
        except PyMongoError:
            logger.exception("No se pudieron crear los índices de '%s'", COLLECTION_NAME)

    async def shutdown(self) -> None:
        self._client.close()

    async def ping(self) -> bool:
        try:
            await self._client.admin.command("ping")
        except PyMongoError:
            return False
        return True

    async def add(self, roulette: Roulette) -> None:
        await self._collection.insert_one(roulette_to_document(roulette))

    async def get(self, roulette_id: str) -> Roulette | None:
        doc = await self._collection.find_one({"_id": roulette_id})
        return roulette_from_document(doc) if doc is not None else None

    async def list_all(self) -> list[Roulette]:
        cursor = self._collection.find().sort("created_at", ASCENDING)
        return [roulette_from_document(doc) async for doc in cursor]

    async def open(self, roulette_id: str) -> Roulette:
        # El filtro por `status` replica la precondición del dominio para que la
        # apertura sea atómica; si no casa, el dominio produce el error exacto.
        doc = await self._collection.find_one_and_update(
            {"_id": roulette_id, "status": str(RouletteStatus.CREATED)},
            {"$set": {"status": str(RouletteStatus.OPEN), "opened_at": datetime.now(UTC)}},
            return_document=ReturnDocument.AFTER,
        )
        if doc is None:
            await self._raise_state_error(roulette_id, Roulette.ensure_can_open)
        return roulette_from_document(doc)

    async def append_bet(self, roulette_id: str, bet: Bet) -> Bet:
        result = await self._collection.update_one(
            {"_id": roulette_id, "status": str(RouletteStatus.OPEN)},
            {"$push": {"bets": bet_to_document(bet)}},
        )
        if result.matched_count == 0:
            await self._raise_state_error(roulette_id, Roulette.ensure_can_receive_bets)
        return bet

    async def close(self, roulette_id: str, winning_number: int) -> Roulette:
        for _ in range(_MAX_CLOSE_ATTEMPTS):
            doc = await self._collection.find_one({"_id": roulette_id})
            if doc is None:
                raise RouletteNotFoundError(roulette_id)
            roulette = roulette_from_document(doc)
            roulette.close(winning_number)
            # Concurrencia optimista. El filtro por `status` evita el doble
            # cierre, y la guarda por `$size` NO sobra: los resultados que se
            # escriben se calcularon sobre la lista de apuestas leída arriba, así
            # que si entró una apuesta mientras se liquidaba, el reemplazo debe
            # fallar y reintentarse; si no, esa apuesta quedaría sin resolver o
            # se perdería al sobrescribir el documento.
            replaced = await self._collection.find_one_and_replace(
                {
                    "_id": roulette_id,
                    "status": str(RouletteStatus.OPEN),
                    "bets": {"$size": len(roulette.bets)},
                },
                roulette_to_document(roulette),
                return_document=ReturnDocument.AFTER,
            )
            if replaced is not None:
                return roulette_from_document(replaced)
            # Si sigue abierta, el reemplazo falló porque entró una apuesta
            # mientras se liquidaba: se reintenta con la lista ya completa.
            await self._raise_state_error(roulette_id, Roulette.ensure_can_close)
        raise InvalidRouletteStateError(
            "No se pudo cerrar la ruleta: siguen entrando apuestas, inténtalo de nuevo"
        )

    async def _raise_state_error(
        self, roulette_id: str, precondicion: Callable[[Roulette], None]
    ) -> None:
        """Distingue 'no existe' de 'estado inválido' releyendo el documento.

        La precondición del dominio se reevalúa sobre la relectura para que el
        mensaje de error sea idéntico al de la implementación en memoria. Si la
        precondición se cumple, la escritura falló por concurrencia y quien
        llama decide si reintenta.
        """
        doc = await self._collection.find_one({"_id": roulette_id})
        if doc is None:
            raise RouletteNotFoundError(roulette_id)
        precondicion(roulette_from_document(doc))
