"""Esquemas pydantic de entrada y salida de la API v1."""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer

from ..domain import Bet, BetColor, BetResult, BetType, Roulette, RouletteStatus

# El contrato expone los importes como números JSON; Decimal se usa puertas
# adentro y solo se convierte a float al serializar.
MoneyOut = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]

BetAmount = Annotated[
    Decimal,
    Field(gt=0, le=Decimal("10000"), decimal_places=2, max_digits=9),
    PlainSerializer(float, return_type=float, when_used="json"),
]


class NumberBetRequest(BaseModel):
    """Apuesta a un número concreto; el campo `color` no se admite aquí."""

    model_config = ConfigDict(extra="forbid")

    type: Literal[BetType.NUMBER]
    number: Annotated[int, Field(ge=0, le=36)]
    amount: BetAmount


class ColorBetRequest(BaseModel):
    """Apuesta a un color; el campo `number` no se admite aquí."""

    model_config = ConfigDict(extra="forbid")

    type: Literal[BetType.COLOR]
    color: BetColor
    amount: BetAmount


BetRequest = Annotated[NumberBetRequest | ColorBetRequest, Field(discriminator="type")]


class RouletteCreatedResponse(BaseModel):
    id: str
    status: RouletteStatus
    created_at: datetime

    @classmethod
    def from_domain(cls, roulette: Roulette) -> RouletteCreatedResponse:
        return cls(id=roulette.id, status=roulette.status, created_at=roulette.created_at)


class OpenRouletteResponse(BaseModel):
    success: bool = True
    roulette_id: str
    status: RouletteStatus
    message: str = "Ruleta abierta"


class BetResponse(BaseModel):
    bet_id: str
    roulette_id: str
    user_id: str
    type: BetType
    number: int | None
    color: BetColor | None
    amount: MoneyOut
    created_at: datetime

    @classmethod
    def from_domain(cls, bet: Bet) -> BetResponse:
        return cls(
            bet_id=bet.id,
            roulette_id=bet.roulette_id,
            user_id=bet.user_id,
            type=bet.type,
            number=bet.number,
            color=bet.color,
            amount=bet.amount,
            created_at=bet.created_at,
        )


class BetResultResponse(BaseModel):
    bet_id: str
    user_id: str
    type: BetType
    number: int | None
    color: BetColor | None
    amount: MoneyOut
    won: bool
    payout: MoneyOut

    @classmethod
    def from_domain(cls, result: BetResult) -> BetResultResponse:
        bet = result.bet
        return cls(
            bet_id=bet.id,
            user_id=bet.user_id,
            type=bet.type,
            number=bet.number,
            color=bet.color,
            amount=bet.amount,
            won=result.won,
            payout=result.payout,
        )


class CloseRouletteResponse(BaseModel):
    roulette_id: str
    status: RouletteStatus
    winning_number: int
    winning_color: BetColor
    closed_at: datetime
    total_bets: int
    total_amount_bet: MoneyOut
    total_amount_paid: MoneyOut
    results: list[BetResultResponse]

    @classmethod
    def from_domain(cls, roulette: Roulette) -> CloseRouletteResponse:
        return cls(
            roulette_id=roulette.id,
            status=roulette.status,
            winning_number=roulette.winning_number,
            winning_color=roulette.winning_color,
            closed_at=roulette.closed_at,
            total_bets=len(roulette.bets),
            total_amount_bet=roulette.total_amount_bet,
            total_amount_paid=roulette.total_amount_paid,
            results=[BetResultResponse.from_domain(result) for result in roulette.results],
        )


class RouletteSummary(BaseModel):
    id: str
    status: RouletteStatus
    created_at: datetime
    opened_at: datetime | None
    closed_at: datetime | None
    winning_number: int | None
    winning_color: BetColor | None
    bets_count: int

    @classmethod
    def from_domain(cls, roulette: Roulette) -> RouletteSummary:
        return cls(
            id=roulette.id,
            status=roulette.status,
            created_at=roulette.created_at,
            opened_at=roulette.opened_at,
            closed_at=roulette.closed_at,
            winning_number=roulette.winning_number,
            winning_color=roulette.winning_color,
            bets_count=len(roulette.bets),
        )


class RouletteDetail(RouletteSummary):
    bets: list[BetResponse]
    results: list[BetResultResponse] | None = None

    @classmethod
    def from_domain(cls, roulette: Roulette) -> RouletteDetail:
        summary = RouletteSummary.from_domain(roulette)
        return cls(
            **summary.model_dump(),
            bets=[BetResponse.from_domain(bet) for bet in roulette.bets],
            results=(
                [BetResultResponse.from_domain(result) for result in roulette.results]
                if roulette.status is RouletteStatus.CLOSED
                else None
            ),
        )


class HealthResponse(BaseModel):
    """`storage` indica el backend en uso; `status` baja a 'degraded' si no responde."""

    status: Literal["ok", "degraded"] = "ok"
    version: str
    storage: str


class ErrorResponse(BaseModel):
    detail: str
