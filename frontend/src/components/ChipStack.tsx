import { CHIP_CLASS, CHIP_VALUES, chipBreakdown } from '../lib/chips'
import type { ChipValue } from '../lib/chips'

const KNOWN = new Set<number>(CHIP_VALUES)

function classFor(value: number): string {
  return KNOWN.has(value) ? CHIP_CLASS[value as ChipValue] : 'chip--odd'
}

/** Fichas apiladas sobre la casilla elegida. */
export function ChipStack({ amount }: { amount: number }) {
  if (amount <= 0) return null
  const stack = chipBreakdown(amount)
  const shown = stack.slice(0, 6)

  return (
    <span className="stack" aria-hidden="true">
      {shown.map((value, index) => (
        <span
          key={`${String(index)}-${String(value)}`}
          className={`stack__chip ${classFor(value)}`}
          style={{ bottom: `${String(index * 3)}px` }}
        />
      ))}
    </span>
  )
}
