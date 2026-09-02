import { describe, expect, it } from 'vitest'
import { addChip, chipBreakdown, chipLabel, sum } from './chips'
import { SECTOR_ANGLE, WHEEL_NUMBERS, angleForNumber } from './wheel'
import { colorOfNumber } from './roulette'

describe('fichas', () => {
  it('apila hasta el tope de la casa y no lo pasa', () => {
    const almost = Array.from({ length: 9 }, () => 1000)
    expect(sum(addChip(almost, 1000))).toBe(10000)
    expect(sum(addChip(Array.from({ length: 10 }, () => 1000), 5))).toBe(10000)
  })

  it('descompone un importe en fichas reales más el resto', () => {
    expect(chipBreakdown(1630)).toEqual([1000, 500, 100, 25, 5])
    expect(chipBreakdown(30)).toEqual([25, 5])
    expect(chipBreakdown(7)).toEqual([5, 2])
  })

  it('abrevia el millar en la cara de la ficha', () => {
    expect(chipLabel(1000)).toBe('1K')
    expect(chipLabel(25)).toBe('25')
  })
})

describe('rueda', () => {
  it('tiene las 37 casillas y reparte el círculo entre ellas', () => {
    expect(WHEEL_NUMBERS).toHaveLength(37)
    expect(SECTOR_ANGLE * 37).toBeCloseTo(360)
  })

  it('gira lo justo para dejar el número bajo la flecha', () => {
    expect(angleForNumber(0)).toBe(0)
    expect(angleForNumber(1)).toBeCloseTo(-SECTOR_ANGLE)
    expect(angleForNumber(36)).toBeCloseTo(-36 * SECTOR_ANGLE)
  })

  it('alterna los colores y deja el empalme rojo-rojo entre 36 y 0', () => {
    expect(colorOfNumber(36)).toBe('red')
    expect(colorOfNumber(0)).toBe('red')
    expect(colorOfNumber(35)).toBe('black')
  })
})
