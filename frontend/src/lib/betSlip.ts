import type { BetColor } from '../api/types'
import { CHIP_VALUES, sum } from './chips'
import type { ChipValue } from './chips'
import { MAX_AMOUNT } from './roulette'

export type Selection = { kind: 'number'; value: number } | { kind: 'color'; value: BetColor }

/**
 * Lo que el jugador tiene puesto en la mesa y todavía no ha confirmado:
 * las fichas apiladas (o un importe exacto escrito) y la casilla elegida.
 * Es un modelo puro para poder probarlo sin montar la interfaz.
 */
export interface BetSlip {
  stack: number[]
  exact: string
  selection: Selection | null
}

export const EMPTY_SLIP: BetSlip = { stack: [], exact: '', selection: null }

export function slipStake(slip: BetSlip): number {
  const manual = slip.exact.trim().replace(',', '.')
  if (manual !== '') {
    const parsed = Number(manual)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return sum(slip.stack)
}

/** Texto del importe tal cual se valida: el manual manda sobre las fichas. */
export function slipAmountText(slip: BetSlip): string {
  return slip.exact.trim() !== '' ? slip.exact : String(sum(slip.stack))
}

export function isSlipEmpty(slip: BetSlip): boolean {
  return slip.stack.length === 0 && slip.exact.trim() === '' && slip.selection === null
}

/** ¿Esta ficha se pasaría del tope de la casa? */
export function chipExceedsCap(slip: BetSlip, value: ChipValue): boolean {
  return slipStake(slip) + value > MAX_AMOUNT
}

export function addSlipChip(slip: BetSlip, value: ChipValue): BetSlip {
  if (chipExceedsCap(slip, value)) return slip
  // Poner fichas descarta el importe escrito a mano: mandan las fichas.
  return { ...slip, exact: '', stack: [...slip.stack, value] }
}

export function undoSlipChip(slip: BetSlip): BetSlip {
  return { ...slip, stack: slip.stack.slice(0, -1) }
}

export function clearSlipAmount(slip: BetSlip): BetSlip {
  return { ...slip, stack: [], exact: '' }
}

export function setSlipExact(slip: BetSlip, text: string): BetSlip {
  return { ...slip, stack: [], exact: text }
}

export function pickSlip(slip: BetSlip, selection: Selection): BetSlip {
  return { ...slip, selection }
}

/**
 * Al confirmar, la mesa queda libre en el acto: las fichas ya viajan al
 * servidor y el jugador puede empezar la siguiente apuesta sin esperar.
 */
export function submitSlip(): BetSlip {
  return EMPTY_SLIP
}

/**
 * Si el servidor rechaza la apuesta se devuelven las fichas, pero solo
 * mientras el jugador no haya empezado otra: su apuesta nueva manda siempre.
 */
export function restoreSlip(current: BetSlip, submitted: BetSlip): BetSlip {
  return isSlipEmpty(current) ? submitted : current
}

/** Denominaciones del riel, para que la interfaz no importe dos módulos. */
export { CHIP_VALUES }
