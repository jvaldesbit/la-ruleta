import { describe, expect, it } from 'vitest'
import { validateBet, validateUserId } from './validation'
import { colorOfNumber, netProfit } from './roulette'

const base = { type: 'number', number: '17', color: 'red', amount: '100' } as const

describe('validateBet', () => {
  it('acepta una apuesta a número válida', () => {
    const result = validateBet({ ...base })
    expect(result).toEqual({ ok: true, bet: { type: 'number', number: 17, amount: 100 } })
  })

  it('acepta una apuesta a color válida', () => {
    const result = validateBet({ ...base, type: 'color', color: 'black', amount: '25,50' })
    expect(result).toEqual({ ok: true, bet: { type: 'color', color: 'black', amount: 25.5 } })
  })

  it('rechaza números fuera de 0..36 y no enteros', () => {
    expect(validateBet({ ...base, number: '37' })).toMatchObject({ ok: false })
    expect(validateBet({ ...base, number: '-1' })).toMatchObject({ ok: false })
    expect(validateBet({ ...base, number: '3.5' })).toMatchObject({ ok: false })
  })

  it('acepta los extremos 0 y 36', () => {
    expect(validateBet({ ...base, number: '0' })).toMatchObject({ ok: true })
    expect(validateBet({ ...base, number: '36' })).toMatchObject({ ok: true })
  })

  it('aplica el rango 0 < monto <= 10000', () => {
    expect(validateBet({ ...base, amount: '0' })).toMatchObject({ ok: false })
    expect(validateBet({ ...base, amount: '10000' })).toMatchObject({ ok: true })
    expect(validateBet({ ...base, amount: '10000.01' })).toMatchObject({ ok: false })
    expect(validateBet({ ...base, amount: '1.234' })).toMatchObject({ ok: false })
    expect(validateBet({ ...base, amount: 'abc' })).toMatchObject({ ok: false })
  })

  it('acumula errores de número y monto a la vez', () => {
    const result = validateBet({ ...base, number: '99', amount: '-5' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.number).toBeDefined()
      expect(result.errors.amount).toBeDefined()
    }
  })
})

describe('validateUserId', () => {
  it('exige un identificador no vacío', () => {
    expect(validateUserId('')).not.toBeNull()
    expect(validateUserId('   ')).not.toBeNull()
    expect(validateUserId('jugador-01')).toBeNull()
  })
})

describe('reglas del enunciado', () => {
  it('par es rojo e impar es negro, con el 0 en rojo', () => {
    expect(colorOfNumber(0)).toBe('red')
    expect(colorOfNumber(1)).toBe('black')
    expect(colorOfNumber(36)).toBe('red')
    expect(colorOfNumber(17)).toBe('black')
  })

  it('la ganancia neta descuenta lo apostado del pago bruto', () => {
    expect(netProfit({ amount: 100, payout: 500 })).toBe(400)
    expect(netProfit({ amount: 100, payout: 0 })).toBe(-100)
  })
})
