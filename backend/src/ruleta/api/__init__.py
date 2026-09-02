"""Capa HTTP: routers, esquemas, dependencias y manejo de errores."""

from .errors import register_exception_handlers
from .routers import router

__all__ = ["register_exception_handlers", "router"]
