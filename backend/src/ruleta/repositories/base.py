"""Contrato de persistencia de ruletas."""

from typing import Protocol

from ..domain import Bet, Roulette


class RouletteRepository(Protocol):
    """Puerto de persistencia de la ruleta como agregado.

    Las transiciones de estado (`open`, `append_bet`, `close`) son operaciones
    del puerto y no una secuencia leer-modificar-guardar del servicio, porque
    solo el adaptador sabe cómo hacerlas atómicas: en memoria con un lock y en
    Mongo con una actualización condicionada al estado esperado. Todas lanzan
    `RouletteNotFoundError` o `InvalidRouletteStateError` del dominio.
    """

    @property
    def backend(self) -> str:
        """Nombre del almacenamiento para el healthcheck (`memory`, `mongo`)."""
        ...

    async def startup(self) -> None:
        """Prepara el almacenamiento al arrancar la app (índices, conexiones)."""
        ...

    async def shutdown(self) -> None:
        """Libera los recursos al apagar la app."""
        ...

    async def ping(self) -> bool:
        """Comprueba que el almacenamiento responde."""
        ...

    async def add(self, roulette: Roulette) -> None: ...

    async def get(self, roulette_id: str) -> Roulette | None: ...

    async def list_all(self) -> list[Roulette]: ...

    async def open(self, roulette_id: str) -> Roulette: ...

    async def append_bet(self, roulette_id: str, bet: Bet) -> Bet: ...

    async def close(self, roulette_id: str, winning_number: int) -> Roulette: ...
