"""Dependencias de FastAPI: repositorio, spinner, servicio y usuario."""

from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request, status

from ..domain import Spinner, secure_spinner
from ..repositories import RouletteRepository
from ..service import RouletteService


def get_repository(request: Request) -> RouletteRepository:
    """El repositorio se elige al arrancar (lifespan) y vive en `app.state`."""
    return request.app.state.repository


def get_spinner() -> Spinner:
    return secure_spinner


def get_service(
    repository: Annotated[RouletteRepository, Depends(get_repository)],
    spinner: Annotated[Spinner, Depends(get_spinner)],
) -> RouletteService:
    return RouletteService(repository, spinner)


def get_user_id(
    x_user_id: Annotated[str | None, Header(alias="X-User-Id")] = None,
) -> str:
    if x_user_id is None or not x_user_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El header X-User-Id es obligatorio y no puede estar vacío",
        )
    return x_user_id.strip()


RepositoryDep = Annotated[RouletteRepository, Depends(get_repository)]
ServiceDep = Annotated[RouletteService, Depends(get_service)]
UserIdDep = Annotated[str, Depends(get_user_id)]
