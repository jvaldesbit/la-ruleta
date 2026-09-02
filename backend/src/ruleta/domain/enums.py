"""Enumeraciones del dominio."""

from enum import StrEnum


class RouletteStatus(StrEnum):
    """Ciclo de vida de una ruleta: created -> open -> closed (closed es terminal)."""

    CREATED = "created"
    OPEN = "open"
    CLOSED = "closed"


class BetColor(StrEnum):
    """Colores admitidos para apostar."""

    RED = "red"
    BLACK = "black"


class BetType(StrEnum):
    """Modalidades de apuesta."""

    NUMBER = "number"
    COLOR = "color"
