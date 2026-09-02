"""Fixtures compartidas: app aislada por test y spinner determinista."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from ruleta.api.dependencies import get_spinner
from ruleta.main import create_app
from ruleta.repositories import InMemoryRouletteRepository


class SpinnerControl:
    """Spinner cuyo resultado se fija desde el test."""

    def __init__(self, number: int = 0) -> None:
        self.number = number

    def __call__(self) -> int:
        return self.number


@pytest.fixture
def spinner() -> SpinnerControl:
    return SpinnerControl()


@pytest.fixture
def client(spinner: SpinnerControl) -> Iterator[TestClient]:
    # Almacén en memoria explícito: los tests no dependen de MONGODB_URI.
    app = create_app(repository=InMemoryRouletteRepository())
    app.dependency_overrides[get_spinner] = lambda: spinner
    with TestClient(app) as test_client:
        yield test_client
