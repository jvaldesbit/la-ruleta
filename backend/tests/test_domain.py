"""Tests del dominio puro."""

from decimal import Decimal

import pytest

from ruleta.domain import (
    Bet,
    BetColor,
    BetType,
    InvalidRouletteStateError,
    Roulette,
    color_for_number,
    fixed_spinner,
    is_winning_bet,
    payout_for,
    quantize_money,
    secure_spinner,
)


@pytest.mark.parametrize("number", range(37))
def test_color_para_toda_la_ruleta(number: int) -> None:
    esperado = BetColor.RED if number % 2 == 0 else BetColor.BLACK
    assert color_for_number(number) is esperado


def test_cero_es_rojo() -> None:
    assert color_for_number(0) is BetColor.RED


@pytest.mark.parametrize("number", [-1, 37, 100])
def test_color_fuera_de_rango(number: int) -> None:
    with pytest.raises(ValueError, match="fuera del rango"):
        color_for_number(number)


def test_payout_numero_es_5x() -> None:
    assert payout_for(BetType.NUMBER, Decimal("100.00"), won=True) == Decimal("500.00")


def test_payout_color_es_1_8x_con_dos_decimales() -> None:
    assert payout_for(BetType.COLOR, Decimal("33.33"), won=True) == Decimal("59.99")


def test_payout_cuantiza_a_dos_decimales() -> None:
    assert payout_for(BetType.COLOR, Decimal("12.34"), won=True) == Decimal("22.21")


def test_quantize_money_usa_half_up() -> None:
    assert quantize_money(Decimal("1.005")) == Decimal("1.01")
    assert quantize_money(Decimal("1.0149")) == Decimal("1.01")


def test_payout_perdedor_es_cero() -> None:
    assert payout_for(BetType.NUMBER, Decimal("10.00"), won=False) == Decimal("0.00")


def test_is_winning_bet() -> None:
    assert is_winning_bet(BetType.NUMBER, 17, number=17)
    assert not is_winning_bet(BetType.NUMBER, 17, number=18)
    assert is_winning_bet(BetType.COLOR, 0, color=BetColor.RED)
    assert not is_winning_bet(BetType.COLOR, 0, color=BetColor.BLACK)


def test_transiciones_de_estado() -> None:
    roulette = Roulette()
    roulette.open()
    with pytest.raises(InvalidRouletteStateError):
        roulette.open()
    roulette.close(7)
    assert roulette.winning_color is BetColor.BLACK
    with pytest.raises(InvalidRouletteStateError):
        roulette.close(7)
    with pytest.raises(InvalidRouletteStateError):
        roulette.place_bet(Bet.on_number(roulette.id, "u1", 7, Decimal("1.00")))


def test_apostar_en_ruleta_recien_creada_falla() -> None:
    roulette = Roulette()
    with pytest.raises(InvalidRouletteStateError):
        roulette.place_bet(Bet.on_color(roulette.id, "u1", BetColor.RED, Decimal("1.00")))


def test_totales_del_periodo() -> None:
    roulette = Roulette()
    roulette.open()
    roulette.place_bet(Bet.on_number(roulette.id, "u1", 5, Decimal("100.00")))
    roulette.place_bet(Bet.on_color(roulette.id, "u2", BetColor.BLACK, Decimal("50.00")))
    roulette.close(5)
    assert roulette.total_amount_bet == Decimal("150.00")
    assert roulette.total_amount_paid == Decimal("590.00")


def test_winning_color_sin_sorteo_es_none() -> None:
    assert Roulette().winning_color is None


def test_spinners() -> None:
    assert fixed_spinner(21)() == 21
    assert 0 <= secure_spinner() <= 36
