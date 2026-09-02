"""Errores de dominio, agnósticos del transporte."""


class DomainError(Exception):
    """Base de los errores de negocio."""


class RouletteNotFoundError(DomainError):
    """La ruleta solicitada no existe."""

    def __init__(self, roulette_id: str) -> None:
        super().__init__(f"No existe la ruleta {roulette_id}")


class InvalidRouletteStateError(DomainError):
    """La operación no es válida para el estado actual de la ruleta."""
