"""Fuente de azar del sorteo, inyectable para poder fijarla en los tests."""

import secrets
from collections.abc import Callable

from .rules import MAX_NUMBER

type Spinner = Callable[[], int]


def secure_spinner() -> int:
    """Número ganador 0..36 con `secrets`, apto para uso criptográfico."""
    return secrets.randbelow(MAX_NUMBER + 1)


def fixed_spinner(number: int) -> Spinner:
    """Spinner determinista; existe para tests y demos reproducibles."""
    return lambda: number
