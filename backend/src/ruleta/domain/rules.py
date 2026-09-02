"""Reglas de negocio puras: colores, resolución de apuestas y pagos."""

from decimal import ROUND_HALF_UP, Decimal

from .enums import BetColor, BetType

MIN_NUMBER = 0
MAX_NUMBER = 36

NUMBER_PAYOUT_MULTIPLIER = Decimal("5")
COLOR_PAYOUT_MULTIPLIER = Decimal("1.8")

_CENTS = Decimal("0.01")


def color_for_number(number: int) -> BetColor:
    """Color de un número: par = rojo, impar = negro.

    Es la regla literal del enunciado, no la de la ruleta real (donde el 0 es
    verde); por tanto el 0, al ser par, cuenta como rojo.
    """
    if not MIN_NUMBER <= number <= MAX_NUMBER:
        raise ValueError(f"El número {number} está fuera del rango 0..36")
    return BetColor.RED if number % 2 == 0 else BetColor.BLACK


def quantize_money(amount: Decimal) -> Decimal:
    """Redondea a 2 decimales con ROUND_HALF_UP, el criterio contable esperado."""
    return amount.quantize(_CENTS, rounding=ROUND_HALF_UP)


def is_winning_bet(
    bet_type: BetType,
    winning_number: int,
    *,
    number: int | None = None,
    color: BetColor | None = None,
) -> bool:
    """Indica si la apuesta acierta el número sorteado."""
    if bet_type is BetType.NUMBER:
        return number == winning_number
    return color == color_for_number(winning_number)


def payout_for(bet_type: BetType, amount: Decimal, *, won: bool) -> Decimal:
    """Pago bruto: 5x al acertar número, 1.8x al acertar color, 0 si falla."""
    if not won:
        return quantize_money(Decimal("0"))
    multiplier = NUMBER_PAYOUT_MULTIPLIER if bet_type is BetType.NUMBER else COLOR_PAYOUT_MULTIPLIER
    return quantize_money(amount * multiplier)
