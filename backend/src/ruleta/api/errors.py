"""Traducción de errores de dominio y de validación al JSON del contrato."""

from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from ..domain import InvalidRouletteStateError, RouletteNotFoundError

_FIELD_LABELS = {
    "number": "el número",
    "color": "el color",
    "amount": "el monto",
    "type": "el tipo de apuesta",
}

# Los mensajes de pydantic vienen en inglés; se traducen los casos que puede
# producir este contrato para cumplir con "detail" siempre en español.
_MESSAGES: dict[str, str] = {
    "missing": "es obligatorio",
    "extra_forbidden": "no se admite para este tipo de apuesta",
    "greater_than": "debe ser mayor que {gt}",
    "greater_than_equal": "debe ser mayor o igual que {ge}",
    "less_than": "debe ser menor que {lt}",
    "less_than_equal": "debe ser menor o igual que {le}",
    "decimal_max_places": "admite como máximo 2 decimales",
    "decimal_max_digits": "tiene demasiados dígitos",
    "decimal_parsing": "no es un número válido",
    "int_parsing": "no es un número entero válido",
    "int_type": "no es un número entero válido",
    "enum": "tiene un valor no admitido",
    "literal_error": "tiene un valor no admitido",
    "union_tag_invalid": "debe ser 'number' o 'color'",
    "union_tag_not_found": "es obligatorio",
}


def _describe(error: dict[str, Any]) -> str:
    tipo = str(error.get("type"))
    location = [part for part in error.get("loc", ()) if part not in ("body", "query", "path")]
    # Los errores del discriminador no apuntan a ningún campo: se atribuyen a `type`.
    if tipo.startswith("union_tag"):
        field = "type"
    else:
        field = str(location[-1]) if location else "la petición"
    plantilla = _MESSAGES.get(tipo, "tiene un valor inválido")
    return f"{_FIELD_LABELS.get(field, field)} {plantilla.format(**error.get('ctx', {}))}"


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(RouletteNotFoundError)
    async def _not_found(_: Request, exc: RouletteNotFoundError) -> JSONResponse:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"detail": str(exc)})

    @app.exception_handler(InvalidRouletteStateError)
    async def _conflict(_: Request, exc: InvalidRouletteStateError) -> JSONResponse:
        return JSONResponse(status_code=status.HTTP_409_CONFLICT, content={"detail": str(exc)})

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        detalle = "; ".join(_describe(error) for error in exc.errors())
        return JSONResponse(
            status_code=422, content={"detail": f"Datos de la petición inválidos: {detalle}"}
        )
