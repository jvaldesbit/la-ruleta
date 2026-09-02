"""Implementación en memoria del repositorio de ruletas."""

import asyncio
import copy

from ..domain import Bet, Roulette, RouletteNotFoundError


class InMemoryRouletteRepository:
    """Almacén en proceso serializado por un lock de asyncio.

    Se guardan y devuelven copias profundas para que nadie mute el estado
    almacenado por accidente desde fuera del repositorio.
    """

    backend = "memory"

    def __init__(self) -> None:
        self._items: dict[str, Roulette] = {}
        self._lock = asyncio.Lock()

    async def startup(self) -> None:
        """No hay nada que preparar: el almacén vive en el propio proceso."""

    async def shutdown(self) -> None:
        """Sin conexiones que cerrar."""

    async def ping(self) -> bool:
        return True

    async def add(self, roulette: Roulette) -> None:
        async with self._lock:
            self._items[roulette.id] = copy.deepcopy(roulette)

    async def get(self, roulette_id: str) -> Roulette | None:
        stored = self._items.get(roulette_id)
        return copy.deepcopy(stored) if stored is not None else None

    async def list_all(self) -> list[Roulette]:
        return [copy.deepcopy(item) for item in self._items.values()]

    async def open(self, roulette_id: str) -> Roulette:
        async with self._lock:
            roulette = self._require(roulette_id)
            roulette.open()
            return copy.deepcopy(roulette)

    async def append_bet(self, roulette_id: str, bet: Bet) -> Bet:
        async with self._lock:
            self._require(roulette_id).place_bet(bet)
            return copy.deepcopy(bet)

    async def close(self, roulette_id: str, winning_number: int) -> Roulette:
        async with self._lock:
            roulette = self._require(roulette_id)
            roulette.close(winning_number)
            return copy.deepcopy(roulette)

    def _require(self, roulette_id: str) -> Roulette:
        # Se devuelve la instancia viva, no una copia: quien la muta dentro del
        # lock está escribiendo directamente en el almacén.
        roulette = self._items.get(roulette_id)
        if roulette is None:
            raise RouletteNotFoundError(roulette_id)
        return roulette
