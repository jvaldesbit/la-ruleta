"""Dominio puro de La Ruleta: sin FastAPI, sin pydantic, sin E/S."""

from .enums import BetColor, BetType, RouletteStatus
from .errors import DomainError, InvalidRouletteStateError, RouletteNotFoundError
from .models import Bet, BetResult, Roulette
from .rules import (
    COLOR_PAYOUT_MULTIPLIER,
    MAX_NUMBER,
    MIN_NUMBER,
    NUMBER_PAYOUT_MULTIPLIER,
    color_for_number,
    is_winning_bet,
    payout_for,
    quantize_money,
)
from .spinner import Spinner, fixed_spinner, secure_spinner

__all__ = [
    "COLOR_PAYOUT_MULTIPLIER",
    "MAX_NUMBER",
    "MIN_NUMBER",
    "NUMBER_PAYOUT_MULTIPLIER",
    "Bet",
    "BetColor",
    "BetResult",
    "BetType",
    "DomainError",
    "InvalidRouletteStateError",
    "Roulette",
    "RouletteNotFoundError",
    "RouletteStatus",
    "Spinner",
    "color_for_number",
    "fixed_spinner",
    "is_winning_bet",
    "payout_for",
    "quantize_money",
    "secure_spinner",
]
