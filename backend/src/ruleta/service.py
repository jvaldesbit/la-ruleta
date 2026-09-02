"""Casos de uso: orquestan dominio y repositorio."""

from decimal import Decimal

from .domain import Bet, BetColor, BetType, Roulette, RouletteNotFoundError, Spinner
from .repositories import RouletteRepository


class RouletteService:
    """Coordina dominio y repositorio; no conoce el almacenamiento concreto."""

    def __init__(self, repository: RouletteRepository, spinner: Spinner) -> None:
        self._repository = repository
        self._spinner = spinner

    async def create_roulette(self) -> Roulette:
        roulette = Roulette()
        await self._repository.add(roulette)
        return roulette

    async def open_roulette(self, roulette_id: str) -> Roulette:
        return await self._repository.open(roulette_id)

    async def place_bet(
        self,
        roulette_id: str,
        user_id: str,
        bet_type: BetType,
        amount: Decimal,
        *,
        number: int | None = None,
        color: BetColor | None = None,
    ) -> Bet:
        bet = (
            Bet.on_number(roulette_id, user_id, number, amount)
            if bet_type is BetType.NUMBER
            else Bet.on_color(roulette_id, user_id, color, amount)
        )
        return await self._repository.append_bet(roulette_id, bet)

    async def close_roulette(self, roulette_id: str) -> Roulette:
        # El repositorio garantiza que, ante cierres concurrentes, solo uno
        # llegue a resolver las apuestas; el resto recibe un error de estado.
        return await self._repository.close(roulette_id, self._spinner())

    async def list_roulettes(self) -> list[Roulette]:
        return await self._repository.list_all()

    async def get_roulette(self, roulette_id: str) -> Roulette:
        return await self._require(roulette_id)

    async def _require(self, roulette_id: str) -> Roulette:
        roulette = await self._repository.get(roulette_id)
        if roulette is None:
            raise RouletteNotFoundError(roulette_id)
        return roulette
