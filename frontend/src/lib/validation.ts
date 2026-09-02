import type { BetColor, BetRequest, BetType } from '../api/types'
import { MAX_AMOUNT, MAX_NUMBER, MIN_NUMBER } from './roulette'

export interface BetDraft {
  type: BetType
  /** Texto crudo del campo número (0..36). */
  number: string
  color: BetColor
  /** Texto crudo del campo monto. */
  amount: string
}

export interface BetFieldErrors {
  number?: string
  amount?: string
}

export type BetValidation =
  | { ok: true; bet: BetRequest }
  | { ok: false; errors: BetFieldErrors }

/** Valida el identificador de usuario tal y como lo exige el backend. */
export function validateUserId(userId: string): string | null {
  return userId.trim() === '' ? 'Introduce un identificador de usuario para apostar.' : null
}

function parseAmount(raw: string): { value: number } | { error: string } {
  const trimmed = raw.trim().replace(',', '.')
  if (trimmed === '') return { error: 'Indica el monto de la apuesta.' }

  const value = Number(trimmed)
  if (!Number.isFinite(value)) return { error: 'El monto debe ser un número.' }
  if (value <= 0) return { error: 'El monto debe ser mayor que 0.' }
  if (value > MAX_AMOUNT) return { error: `El monto no puede superar ${String(MAX_AMOUNT)}.` }
  if (Math.round(value * 100) !== value * 100) {
    return { error: 'El monto admite como mucho 2 decimales.' }
  }

  return { value: Math.round(value * 100) / 100 }
}

function parseNumber(raw: string): { value: number } | { error: string } {
  const trimmed = raw.trim()
  if (trimmed === '') return { error: 'Indica un número entre 0 y 36.' }

  const value = Number(trimmed)
  if (!Number.isInteger(value)) return { error: 'El número debe ser entero.' }
  if (value < MIN_NUMBER || value > MAX_NUMBER) {
    return { error: `El número debe estar entre ${String(MIN_NUMBER)} y ${String(MAX_NUMBER)}.` }
  }

  return { value }
}

/**
 * Valida la apuesta en cliente con las mismas reglas del backend.
 * El servidor sigue siendo la autoridad: su error se muestra tal cual llega.
 */
export function validateBet(draft: BetDraft): BetValidation {
  const errors: BetFieldErrors = {}

  const amount = parseAmount(draft.amount)
  if ('error' in amount) errors.amount = amount.error

  if (draft.type === 'number') {
    const number = parseNumber(draft.number)
    if ('error' in number) errors.number = number.error

    if ('value' in amount && 'value' in number) {
      return { ok: true, bet: { type: 'number', number: number.value, amount: amount.value } }
    }
    return { ok: false, errors }
  }

  if ('value' in amount) {
    return { ok: true, bet: { type: 'color', color: draft.color, amount: amount.value } }
  }
  return { ok: false, errors }
}
