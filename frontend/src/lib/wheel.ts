import { MAX_NUMBER } from './roulette'

/**
 * Orden de las casillas en la rueda: 0..36 en orden natural.
 * Con la regla del proyecto (par rojo, impar negro) los colores quedan
 * alternos y la regla se lee de un vistazo; el empalme 36-0, rojo con rojo,
 * deja a la vista que el cero también es rojo.
 */
export const WHEEL_NUMBERS: readonly number[] = Array.from({ length: MAX_NUMBER + 1 }, (_, i) => i)

export const SECTOR_ANGLE = 360 / WHEEL_NUMBERS.length

/** Grados que hay que girar la rueda para dejar `value` bajo la flecha. */
export function angleForNumber(value: number): number {
  const index = WHEEL_NUMBERS.indexOf(value)
  return index <= 0 ? 0 : -index * SECTOR_ANGLE
}

/** Punto del borde de un sector, en coordenadas del SVG (centro 0,0). */
export function polar(radius: number, degrees: number): { x: number; y: number } {
  const radians = ((degrees - 90) * Math.PI) / 180
  return { x: radius * Math.cos(radians), y: radius * Math.sin(radians) }
}

/** Trazado de un sector anular entre dos radios. */
export function sectorPath(inner: number, outer: number, from: number, to: number): string {
  const a = polar(outer, from)
  const b = polar(outer, to)
  const c = polar(inner, to)
  const d = polar(inner, from)
  return [
    `M ${a.x.toFixed(3)} ${a.y.toFixed(3)}`,
    `A ${String(outer)} ${String(outer)} 0 0 1 ${b.x.toFixed(3)} ${b.y.toFixed(3)}`,
    `L ${c.x.toFixed(3)} ${c.y.toFixed(3)}`,
    `A ${String(inner)} ${String(inner)} 0 0 0 ${d.x.toFixed(3)} ${d.y.toFixed(3)}`,
    'Z',
  ].join(' ')
}
