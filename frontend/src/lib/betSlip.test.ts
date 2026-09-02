import { describe, expect, it } from 'vitest'
import {
  EMPTY_SLIP,
  addSlipChip,
  chipExceedsCap,
  clearSlipAmount,
  isSlipEmpty,
  pickSlip,
  restoreSlip,
  setSlipExact,
  slipAmountText,
  slipStake,
  submitSlip,
  undoSlipChip,
} from './betSlip'
import type { BetSlip } from './betSlip'

function apuesta(...chips: (5 | 25 | 100 | 500 | 1000)[]): BetSlip {
  return chips.reduce<BetSlip>((slip, value) => addSlipChip(slip, value), EMPTY_SLIP)
}

describe('acumulado de fichas', () => {
  it('suma las fichas puestas', () => {
    expect(slipStake(apuesta(100, 25, 5))).toBe(130)
  })

  it('el importe exacto sustituye a las fichas y viceversa', () => {
    const manual = setSlipExact(apuesta(100), '250,50')
    expect(slipStake(manual)).toBe(250.5)
    expect(manual.stack).toEqual([])
    expect(slipStake(addSlipChip(manual, 5))).toBe(5)
  })

  it('respeta el tope de 10.000 y avisa antes de pasarse', () => {
    const casiTope = apuesta(1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 500)
    expect(slipStake(casiTope)).toBe(9500)
    expect(chipExceedsCap(casiTope, 500)).toBe(false)
    expect(chipExceedsCap(casiTope, 1000)).toBe(true)
    expect(slipStake(addSlipChip(casiTope, 1000))).toBe(9500)
    expect(slipStake(addSlipChip(casiTope, 500))).toBe(10000)
  })

  it('quitar retira la última ficha y vaciar las deja todas', () => {
    expect(slipStake(undoSlipChip(apuesta(100, 25)))).toBe(100)
    expect(slipStake(clearSlipAmount(apuesta(100, 25)))).toBe(0)
  })

  it('el texto del importe es el que se valida', () => {
    expect(slipAmountText(apuesta(100, 5))).toBe('105')
    expect(slipAmountText(setSlipExact(EMPTY_SLIP, '12,5'))).toBe('12,5')
  })
})

describe('dos apuestas seguidas sobre la misma mesa', () => {
  it('queda lista para la siguiente en cuanto se confirma, sin perder clics', () => {
    let slip = pickSlip(addSlipChip(EMPTY_SLIP, 100), { kind: 'number', value: 17 })
    expect(slipStake(slip)).toBe(100)

    // Confirmar: la mesa se vacía en el acto, la petición ya va de camino.
    slip = submitSlip()
    expect(isSlipEmpty(slip)).toBe(true)

    // Segunda apuesta sin recargar: el primer clic de ficha ya cuenta.
    slip = addSlipChip(slip, 500)
    expect(slipStake(slip)).toBe(500)
    slip = pickSlip(slip, { kind: 'color', value: 'black' })
    expect(slip.selection).toEqual({ kind: 'color', value: 'black' })
    expect(slipStake(slip)).toBe(500)
  })

  it('devuelve las fichas si el servidor rechaza y el jugador no ha tocado nada', () => {
    const enviada = pickSlip(addSlipChip(EMPTY_SLIP, 500), { kind: 'number', value: 7 })
    expect(restoreSlip(submitSlip(), enviada)).toEqual(enviada)
  })

  it('no pisa la apuesta nueva cuando el fallo de la anterior llega tarde', () => {
    const enviada = pickSlip(addSlipChip(EMPTY_SLIP, 500), { kind: 'number', value: 7 })
    const nueva = pickSlip(addSlipChip(EMPTY_SLIP, 25), { kind: 'color', value: 'red' })
    expect(restoreSlip(nueva, enviada)).toEqual(nueva)
  })
})
