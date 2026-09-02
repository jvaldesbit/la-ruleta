"""Routers de la API v1."""

from fastapi import APIRouter, Response, status

from ..config import get_settings
from ..domain import BetType
from .dependencies import RepositoryDep, ServiceDep, UserIdDep
from .schemas import (
    BetRequest,
    BetResponse,
    CloseRouletteResponse,
    ErrorResponse,
    HealthResponse,
    OpenRouletteResponse,
    RouletteCreatedResponse,
    RouletteDetail,
    RouletteSummary,
)

router = APIRouter()

_NOT_FOUND = {404: {"model": ErrorResponse}}
_CONFLICT = {409: {"model": ErrorResponse}}


@router.get(
    "/health",
    response_model=HealthResponse,
    responses={503: {"model": HealthResponse}},
    tags=["health"],
)
async def health(repository: RepositoryDep, response: Response) -> HealthResponse:
    # 503 y no 200: lo consultan el healthcheck del contenedor y el proxy, y una
    # API que no alcanza su almacén no puede atender apuestas; con 200 se le
    # seguiría mandando tráfico. Con el almacén en memoria nunca se degrada.
    alive = await repository.ping()
    if not alive:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return HealthResponse(
        status="ok" if alive else "degraded",
        version=get_settings().app_version,
        storage=repository.backend,
    )


@router.post(
    "/roulettes",
    response_model=RouletteCreatedResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["roulettes"],
)
async def create_roulette(service: ServiceDep) -> RouletteCreatedResponse:
    return RouletteCreatedResponse.from_domain(await service.create_roulette())


@router.get("/roulettes", response_model=list[RouletteSummary], tags=["roulettes"])
async def list_roulettes(service: ServiceDep) -> list[RouletteSummary]:
    return [RouletteSummary.from_domain(item) for item in await service.list_roulettes()]


@router.get(
    "/roulettes/{roulette_id}",
    response_model=RouletteDetail,
    responses=_NOT_FOUND,
    tags=["roulettes"],
)
async def get_roulette(roulette_id: str, service: ServiceDep) -> RouletteDetail:
    return RouletteDetail.from_domain(await service.get_roulette(roulette_id))


@router.post(
    "/roulettes/{roulette_id}/open",
    response_model=OpenRouletteResponse,
    responses=_NOT_FOUND | _CONFLICT,
    tags=["roulettes"],
)
async def open_roulette(roulette_id: str, service: ServiceDep) -> OpenRouletteResponse:
    roulette = await service.open_roulette(roulette_id)
    return OpenRouletteResponse(roulette_id=roulette.id, status=roulette.status)


@router.post(
    "/roulettes/{roulette_id}/bets",
    response_model=BetResponse,
    status_code=status.HTTP_201_CREATED,
    responses=_NOT_FOUND | _CONFLICT,
    tags=["bets"],
)
async def place_bet(
    roulette_id: str,
    payload: BetRequest,
    user_id: UserIdDep,
    service: ServiceDep,
) -> BetResponse:
    bet = await service.place_bet(
        roulette_id,
        user_id,
        BetType(payload.type),
        payload.amount,
        number=getattr(payload, "number", None),
        color=getattr(payload, "color", None),
    )
    return BetResponse.from_domain(bet)


@router.post(
    "/roulettes/{roulette_id}/close",
    response_model=CloseRouletteResponse,
    responses=_NOT_FOUND | _CONFLICT,
    tags=["roulettes"],
)
async def close_roulette(roulette_id: str, service: ServiceDep) -> CloseRouletteResponse:
    return CloseRouletteResponse.from_domain(await service.close_roulette(roulette_id))
