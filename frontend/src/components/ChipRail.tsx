import { useState } from 'react'
import { CHIP_CLASS, CHIP_VALUES, chipLabel } from '../lib/chips'
import type { ChipValue } from '../lib/chips'
import { MAX_AMOUNT } from '../lib/roulette'
import { formatMoney } from '../lib/format'
import { Icon } from './Icon'

interface ChipRailProps {
  stack: readonly number[]
  stake: number
  disabled: boolean
  onAdd: (value: ChipValue) => void
  onUndo: () => void
  onClear: () => void
  onSetExact: (amount: string) => void
  exact: string
}

export function ChipRail({
  stack,
  stake,
  disabled,
  onAdd,
  onUndo,
  onClear,
  onSetExact,
  exact,
}: ChipRailProps) {
  const [manual, setManual] = useState(false)

  return (
    <div className="rail">
      <div className="rail__chips" role="group" aria-label="Fichas">
        {CHIP_VALUES.map((value) => {
          const wouldExceed = stake + value > MAX_AMOUNT
          return (
            <button
              key={value}
              type="button"
              className={`chip ${CHIP_CLASS[value]}`}
              disabled={disabled || wouldExceed}
              title={wouldExceed ? `Superaría el tope de ${formatMoney(MAX_AMOUNT)}` : undefined}
              onClick={() => {
                onAdd(value)
              }}
            >
              <span className="chip__face">{chipLabel(value)}</span>
            </button>
          )
        })}
      </div>

      <div className="rail__side">
        <div className="rail__total">
          <span className="rail__total-label">Apuesta</span>
          <span className="rail__total-value">{formatMoney(stake)}</span>
        </div>
        <div className="rail__tools">
          <button
            type="button"
            className="ghost"
            disabled={disabled || stack.length === 0}
            onClick={onUndo}
          >
            <Icon name="undo" size={15} />
            Quitar
          </button>
          <button type="button" className="ghost" disabled={disabled || stake === 0} onClick={onClear}>
            <Icon name="close" size={15} />
            Vaciar
          </button>
          <button
            type="button"
            className="ghost"
            aria-expanded={manual}
            onClick={() => {
              setManual((open) => !open)
            }}
          >
            Importe exacto
          </button>
        </div>
      </div>

      {manual ? (
        <label className="rail__exact">
          <span className="sr-only">Importe exacto en dólares</span>
          <input
            type="number"
            inputMode="decimal"
            min={0.01}
            max={MAX_AMOUNT}
            step={0.01}
            value={exact}
            disabled={disabled}
            placeholder={`0,01 – ${String(MAX_AMOUNT)}`}
            onChange={(event) => {
              onSetExact(event.target.value)
            }}
          />
        </label>
      ) : null}
    </div>
  )
}
