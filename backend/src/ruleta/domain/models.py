"""Entidades del dominio y sus transiciones de estado."""

from dataclasses import dataclass, field
from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

from .enums import BetColor, BetType, RouletteStatus
from .errors import InvalidRouletteStateError
from .rules import color_for_number, is_winning_bet, payout_for


def _now() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return str(uuid4())


@dataclass(slots=True)
class Bet:
    """Apuesta de un usuario dentro de una ruleta."""

    id: str
    roulette_id: str
    user_id: str
    type: BetType
    amount: Decimal
    created_at: datetime
    number: int | None = None
    color: BetColor | None = None

    @classmethod
    def on_number(cls, roulette_id: str, user_id: str, number: int, amount: Decimal) -> Bet:
        return cls(
            id=_new_id(),
            roulette_id=roulette_id,
            user_id=user_id,
            type=BetType.NUMBER,
            amount=amount,
            created_at=_now(),
            number=number,
        )

    @classmethod
    def on_color(cls, roulette_id: str, user_id: str, color: BetColor, amount: Decimal) -> Bet:
        return cls(
            id=_new_id(),
            roulette_id=roulette_id,
            user_id=user_id,
            type=BetType.COLOR,
            amount=amount,
            created_at=_now(),
            color=color,
        )


@dataclass(slots=True)
class BetResult:
    """Resolución de una apuesta una vez sorteado el número."""

    bet: Bet
    won: bool
    payout: Decimal


@dataclass(slots=True)
class Roulette:
    """Ruleta con sus apuestas y, si ya cerró, los resultados del periodo."""

    id: str = field(default_factory=_new_id)
    status: RouletteStatus = RouletteStatus.CREATED
    created_at: datetime = field(default_factory=_now)
    opened_at: datetime | None = None
    closed_at: datetime | None = None
    winning_number: int | None = None
    bets: list[Bet] = field(default_factory=list)
    results: list[BetResult] = field(default_factory=list)

    @property
    def winning_color(self) -> BetColor | None:
        if self.winning_number is None:
            return None
        return color_for_number(self.winning_number)

    def ensure_can_open(self) -> None:
        if self.status is not RouletteStatus.CREATED:
            raise InvalidRouletteStateError(
                f"La ruleta no se puede abrir porque su estado es '{self.status}'"
            )

    def ensure_can_receive_bets(self) -> None:
        if self.status is not RouletteStatus.OPEN:
            raise InvalidRouletteStateError(
                f"No se puede apostar: la ruleta está en estado '{self.status}'"
            )

    def ensure_can_close(self) -> None:
        if self.status is not RouletteStatus.OPEN:
            raise InvalidRouletteStateError(
                f"La ruleta no se puede cerrar porque su estado es '{self.status}'"
            )

    def open(self) -> None:
        self.ensure_can_open()
        self.status = RouletteStatus.OPEN
        self.opened_at = _now()

    def place_bet(self, bet: Bet) -> Bet:
        self.ensure_can_receive_bets()
        self.bets.append(bet)
        return bet

    def close(self, winning_number: int) -> list[BetResult]:
        self.ensure_can_close()
        self.winning_number = winning_number
        self.status = RouletteStatus.CLOSED
        self.closed_at = _now()
        self.results = [self._resolve(bet, winning_number) for bet in self.bets]
        return self.results

    @staticmethod
    def _resolve(bet: Bet, winning_number: int) -> BetResult:
        won = is_winning_bet(bet.type, winning_number, number=bet.number, color=bet.color)
        return BetResult(bet=bet, won=won, payout=payout_for(bet.type, bet.amount, won=won))

    @property
    def total_amount_bet(self) -> Decimal:
        return sum((bet.amount for bet in self.bets), Decimal("0"))

    @property
    def total_amount_paid(self) -> Decimal:
        return sum((result.payout for result in self.results), Decimal("0"))
