import { MAX_AMOUNT } from './roulette'

/** Denominaciones del riel, de menor a mayor. */
export const CHIP_VALUES = [5, 25, 100, 500, 1000] as const

export type ChipValue = (typeof CHIP_VALUES)[number]

export const CHIP_CLASS: Record<ChipValue, string> = {
  5: 'chip--5',
  25: 'chip--25',
  100: 'chip--100',
  500: 'chip--500',
  1000: 'chip--1000',
}

/** Etiqueta corta de una ficha: 1000 se lee «1K» para que quepa en el disco. */
export function chipLabel(value: number): string {
  return value >= 1000 ? `${String(value / 1000)}K` : String(value)
}

export function sum(stack: readonly number[]): number {
  return stack.reduce((total, value) => total + value, 0)
}

/** Añade una ficha si no revienta el tope de la casa. */
export function addChip(stack: readonly number[], value: ChipValue): number[] {
  return sum(stack) + value > MAX_AMOUNT ? [...stack] : [...stack, value]
}

/**
 * Descompone un importe en fichas para poder dibujarlo apilado.
 * Lo que no llega a la ficha menor queda como resto y se dibuja como ficha suelta.
 */
export function chipBreakdown(amount: number): number[] {
  const stack: number[] = []
  let rest = amount
  for (let i = CHIP_VALUES.length - 1; i >= 0; i -= 1) {
    const value = CHIP_VALUES[i]
    if (value === undefined) continue
    while (rest >= value && stack.length < 24) {
      stack.push(value)
      rest -= value
    }
  }
  if (rest > 0 && stack.length < 24) stack.push(rest)
  return stack
}
