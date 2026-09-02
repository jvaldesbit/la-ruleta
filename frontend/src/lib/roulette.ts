import type { BetColor, BetResult } from '../api/types'

export const MIN_NUMBER = 0
export const MAX_NUMBER = 36
export const MAX_AMOUNT = 10000
export const NUMBER_MULTIPLIER = 5
export const COLOR_MULTIPLIER = 1.8

/**
 * Color de un número según el enunciado: **par = rojo, impar = negro**.
 * El 0 es par y por tanto rojo, a diferencia de la ruleta real.
 */
export function colorOfNumber(value: number): BetColor {
  return value % 2 === 0 ? 'red' : 'black'
}

export const COLOR_LABEL: Record<BetColor, string> = {
  red: 'Rojo',
  black: 'Negro',
}

/** Ganancia neta de una apuesta: pago bruto menos lo apostado. */
export function netProfit(result: Pick<BetResult, 'amount' | 'payout'>): number {
  return result.payout - result.amount
}
