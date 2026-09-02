"""Tests de la API v1 contra el contrato."""

import pytest
from fastapi.testclient import TestClient

from .conftest import SpinnerControl

HEADERS = {"X-User-Id": "u1"}


def crear(client: TestClient) -> str:
    response = client.post("/api/v1/roulettes")
    assert response.status_code == 201
    return response.json()["id"]


def crear_abierta(client: TestClient) -> str:
    roulette_id = crear(client)
    assert client.post(f"/api/v1/roulettes/{roulette_id}/open").status_code == 200
    return roulette_id


def test_health(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["version"]
    assert response.json()["storage"] == "memory"


def test_crear_devuelve_id(client: TestClient) -> None:
    response = client.post("/api/v1/roulettes")
    body = response.json()
    assert response.status_code == 201
    assert body["id"]
    assert body["status"] == "created"
    assert body["created_at"]


def test_abrir_ruleta(client: TestClient) -> None:
    roulette_id = crear(client)
    response = client.post(f"/api/v1/roulettes/{roulette_id}/open")
    assert response.status_code == 200
    assert response.json() == {
        "success": True,
        "roulette_id": roulette_id,
        "status": "open",
        "message": "Ruleta abierta",
    }


def test_abrir_dos_veces_es_conflicto(client: TestClient) -> None:
    roulette_id = crear_abierta(client)
    response = client.post(f"/api/v1/roulettes/{roulette_id}/open")
    assert response.status_code == 409
    assert isinstance(response.json()["detail"], str)


def test_abrir_ruleta_inexistente(client: TestClient) -> None:
    response = client.post("/api/v1/roulettes/no-existe/open")
    assert response.status_code == 404


def test_apuesta_a_numero(client: TestClient) -> None:
    roulette_id = crear_abierta(client)
    response = client.post(
        f"/api/v1/roulettes/{roulette_id}/bets",
        json={"type": "number", "number": 17, "amount": 100.00},
        headers=HEADERS,
    )
    body = response.json()
    assert response.status_code == 201
    assert body["bet_id"]
    assert body["roulette_id"] == roulette_id
    assert body["user_id"] == "u1"
    assert body["type"] == "number"
    assert body["number"] == 17
    assert body["color"] is None
    assert body["amount"] == 100.0


def test_apuesta_a_color(client: TestClient) -> None:
    roulette_id = crear_abierta(client)
    response = client.post(
        f"/api/v1/roulettes/{roulette_id}/bets",
        json={"type": "color", "color": "red", "amount": 25.50},
        headers=HEADERS,
    )
    body = response.json()
    assert response.status_code == 201
    assert body["type"] == "color"
    assert body["color"] == "red"
    assert body["number"] is None
    assert body["amount"] == 25.5


def test_apuesta_sin_header_de_usuario(client: TestClient) -> None:
    roulette_id = crear_abierta(client)
    response = client.post(
        f"/api/v1/roulettes/{roulette_id}/bets",
        json={"type": "number", "number": 1, "amount": 10.00},
    )
    assert response.status_code == 400


def test_apuesta_con_header_vacio(client: TestClient) -> None:
    roulette_id = crear_abierta(client)
    response = client.post(
        f"/api/v1/roulettes/{roulette_id}/bets",
        json={"type": "number", "number": 1, "amount": 10.00},
        headers={"X-User-Id": "   "},
    )
    assert response.status_code == 400


@pytest.mark.parametrize("number", [37, -1])
def test_apuesta_con_numero_fuera_de_rango(client: TestClient, number: int) -> None:
    roulette_id = crear_abierta(client)
    response = client.post(
        f"/api/v1/roulettes/{roulette_id}/bets",
        json={"type": "number", "number": number, "amount": 10.00},
        headers=HEADERS,
    )
    assert response.status_code == 422
    assert isinstance(response.json()["detail"], str)


@pytest.mark.parametrize(
    ("amount", "esperado"),
    [(0, 422), (10000, 201), (10000.01, 422), (0.001, 422), (-5, 422)],
)
def test_rango_de_monto(client: TestClient, amount: float, esperado: int) -> None:
    roulette_id = crear_abierta(client)
    response = client.post(
        f"/api/v1/roulettes/{roulette_id}/bets",
        json={"type": "number", "number": 3, "amount": amount},
        headers=HEADERS,
    )
    assert response.status_code == esperado


def test_color_invalido(client: TestClient) -> None:
    roulette_id = crear_abierta(client)
    response = client.post(
        f"/api/v1/roulettes/{roulette_id}/bets",
        json={"type": "color", "color": "green", "amount": 10.00},
        headers=HEADERS,
    )
    assert response.status_code == 422


def test_campos_cruzados_prohibidos(client: TestClient) -> None:
    roulette_id = crear_abierta(client)
    con_color = client.post(
        f"/api/v1/roulettes/{roulette_id}/bets",
        json={"type": "number", "number": 3, "color": "red", "amount": 10.00},
        headers=HEADERS,
    )
    con_numero = client.post(
        f"/api/v1/roulettes/{roulette_id}/bets",
        json={"type": "color", "color": "red", "number": 3, "amount": 10.00},
        headers=HEADERS,
    )
    tipo_desconocido = client.post(
        f"/api/v1/roulettes/{roulette_id}/bets",
        json={"type": "dozen", "amount": 10.00},
        headers=HEADERS,
    )
    assert con_color.status_code == 422
    assert con_numero.status_code == 422
    assert tipo_desconocido.status_code == 422


def test_apuesta_en_ruleta_no_abierta(client: TestClient) -> None:
    roulette_id = crear(client)
    response = client.post(
        f"/api/v1/roulettes/{roulette_id}/bets",
        json={"type": "number", "number": 3, "amount": 10.00},
        headers=HEADERS,
    )
    assert response.status_code == 409


def test_apuesta_en_ruleta_cerrada(client: TestClient) -> None:
    roulette_id = crear_abierta(client)
    client.post(f"/api/v1/roulettes/{roulette_id}/close")
    response = client.post(
        f"/api/v1/roulettes/{roulette_id}/bets",
        json={"type": "number", "number": 3, "amount": 10.00},
        headers=HEADERS,
    )
    assert response.status_code == 409


def test_apuesta_en_ruleta_inexistente(client: TestClient) -> None:
    response = client.post(
        "/api/v1/roulettes/no-existe/bets",
        json={"type": "number", "number": 3, "amount": 10.00},
        headers=HEADERS,
    )
    assert response.status_code == 404


def test_cierre_paga_5x_al_acertar_numero(client: TestClient, spinner: SpinnerControl) -> None:
    spinner.number = 17
    roulette_id = crear_abierta(client)
    client.post(
        f"/api/v1/roulettes/{roulette_id}/bets",
        json={"type": "number", "number": 17, "amount": 100.00},
        headers=HEADERS,
    )
    body = client.post(f"/api/v1/roulettes/{roulette_id}/close").json()
    assert body["winning_number"] == 17
    assert body["winning_color"] == "black"
    assert body["results"][0]["won"] is True
    assert body["results"][0]["payout"] == 500.0
    assert body["total_amount_paid"] == 500.0


def test_cierre_paga_1_8x_al_acertar_color(client: TestClient, spinner: SpinnerControl) -> None:
    spinner.number = 4
    roulette_id = crear_abierta(client)
    client.post(
        f"/api/v1/roulettes/{roulette_id}/bets",
        json={"type": "color", "color": "red", "amount": 100.00},
        headers=HEADERS,
    )
    body = client.post(f"/api/v1/roulettes/{roulette_id}/close").json()
    assert body["winning_color"] == "red"
    assert body["results"][0]["payout"] == 180.0


def test_cierre_con_cero_gana_el_rojo(client: TestClient, spinner: SpinnerControl) -> None:
    spinner.number = 0
    roulette_id = crear_abierta(client)
    client.post(
        f"/api/v1/roulettes/{roulette_id}/bets",
        json={"type": "color", "color": "red", "amount": 10.00},
        headers={"X-User-Id": "rojo"},
    )
    client.post(
        f"/api/v1/roulettes/{roulette_id}/bets",
        json={"type": "color", "color": "black", "amount": 10.00},
        headers={"X-User-Id": "negro"},
    )
    body = client.post(f"/api/v1/roulettes/{roulette_id}/close").json()
    resultados = {result["user_id"]: result for result in body["results"]}
    assert body["winning_number"] == 0
    assert body["winning_color"] == "red"
    assert resultados["rojo"]["won"] is True
    assert resultados["rojo"]["payout"] == 18.0
    assert resultados["negro"]["won"] is False
    assert resultados["negro"]["payout"] == 0.0


def test_cierre_devuelve_todas_las_apuestas_con_totales(
    client: TestClient, spinner: SpinnerControl
) -> None:
    spinner.number = 7
    roulette_id = crear_abierta(client)
    apuestas = [
        ({"type": "number", "number": 7, "amount": 100.00}, "u1"),
        ({"type": "color", "color": "black", "amount": 50.00}, "u2"),
        ({"type": "number", "number": 8, "amount": 20.00}, "u3"),
    ]
    for payload, user in apuestas:
        client.post(
            f"/api/v1/roulettes/{roulette_id}/bets",
            json=payload,
            headers={"X-User-Id": user},
        )
    response = client.post(f"/api/v1/roulettes/{roulette_id}/close")
    body = response.json()
    assert response.status_code == 200
    assert body["status"] == "closed"
    assert body["closed_at"]
    assert body["total_bets"] == 3
    assert body["total_amount_bet"] == 170.0
    assert body["total_amount_paid"] == 590.0
    assert len(body["results"]) == 3
    assert [result["won"] for result in body["results"]] == [True, True, False]


def test_cierre_repetido_es_conflicto(client: TestClient) -> None:
    roulette_id = crear_abierta(client)
    assert client.post(f"/api/v1/roulettes/{roulette_id}/close").status_code == 200
    assert client.post(f"/api/v1/roulettes/{roulette_id}/close").status_code == 409


def test_cierre_de_ruleta_no_abierta(client: TestClient) -> None:
    roulette_id = crear(client)
    assert client.post(f"/api/v1/roulettes/{roulette_id}/close").status_code == 409


def test_cierre_de_ruleta_inexistente(client: TestClient) -> None:
    assert client.post("/api/v1/roulettes/no-existe/close").status_code == 404


def test_listado_de_ruletas(client: TestClient) -> None:
    crear(client)
    crear_abierta(client)
    body = client.get("/api/v1/roulettes").json()
    assert len(body) == 2
    assert {item["status"] for item in body} == {"created", "open"}
    assert all(item["bets_count"] == 0 for item in body)


def test_detalle_de_ruleta(client: TestClient, spinner: SpinnerControl) -> None:
    spinner.number = 11
    roulette_id = crear_abierta(client)
    client.post(
        f"/api/v1/roulettes/{roulette_id}/bets",
        json={"type": "number", "number": 11, "amount": 10.00},
        headers=HEADERS,
    )
    abierta = client.get(f"/api/v1/roulettes/{roulette_id}").json()
    assert abierta["bets_count"] == 1
    assert len(abierta["bets"]) == 1
    assert abierta["results"] is None
    assert abierta["opened_at"]

    client.post(f"/api/v1/roulettes/{roulette_id}/close")
    cerrada = client.get(f"/api/v1/roulettes/{roulette_id}").json()
    assert cerrada["status"] == "closed"
    assert cerrada["winning_number"] == 11
    assert cerrada["winning_color"] == "black"
    assert cerrada["results"][0]["payout"] == 50.0


def test_detalle_de_ruleta_inexistente(client: TestClient) -> None:
    assert client.get("/api/v1/roulettes/no-existe").status_code == 404


def test_mensajes_de_error_en_espanol(client: TestClient) -> None:
    roulette_id = crear_abierta(client)
    monto = client.post(
        f"/api/v1/roulettes/{roulette_id}/bets",
        json={"type": "number", "number": 3, "amount": 10000.01},
        headers=HEADERS,
    )
    tipo = client.post(
        f"/api/v1/roulettes/{roulette_id}/bets",
        json={"amount": 10.00},
        headers=HEADERS,
    )
    decimales = client.post(
        f"/api/v1/roulettes/{roulette_id}/bets",
        json={"type": "number", "number": 3, "amount": 10.005},
        headers=HEADERS,
    )
    assert monto.json()["detail"] == (
        "Datos de la petición inválidos: el monto debe ser menor o igual que 10000"
    )
    assert tipo.json()["detail"] == (
        "Datos de la petición inválidos: el tipo de apuesta es obligatorio"
    )
    assert decimales.status_code == 422
    assert "decimales" in decimales.json()["detail"]
