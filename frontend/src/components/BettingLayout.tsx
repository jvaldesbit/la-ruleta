import type { BetColor } from '../api/types'
import { MAX_NUMBER, colorOfNumber } from '../lib/roulette'
import { ChipStack } from './ChipStack'

export type Selection = { kind: 'number'; value: number } | { kind: 'color'; value: BetColor }

interface BettingLayoutProps {
  selection: Selection | null
  stake: number
  disabled: boolean
  onSelect: (selection: Selection) => void
}

const NUMBERS = Array.from({ length: MAX_NUMBER }, (_, i) => i + 1)

export function BettingLayout({ selection, stake, disabled, onSelect }: BettingLayoutProps) {
  const isNumberPicked = (value: number) => selection?.kind === 'number' && selection.value === value
  const isColorPicked = (value: BetColor) => selection?.kind === 'color' && selection.value === value

  return (
    <div className={`felt${disabled ? ' is-disabled' : ''}`}>
      <div className="felt__grid">
        <button
          type="button"
          disabled={disabled}
          aria-pressed={isNumberPicked(0)}
          className={`cell cell--zero cell--red${isNumberPicked(0) ? ' is-picked' : ''}`}
          onClick={() => {
            onSelect({ kind: 'number', value: 0 })
          }}
        >
          <span className="cell__digit">0</span>
          {isNumberPicked(0) ? <ChipStack amount={stake} /> : null}
        </button>

        {NUMBERS.map((value) => {
          const color = colorOfNumber(value)
          const picked = isNumberPicked(value)
          return (
            <button
              key={value}
              type="button"
              disabled={disabled}
              aria-pressed={picked}
              className={`cell cell--${color}${picked ? ' is-picked' : ''}`}
              onClick={() => {
                onSelect({ kind: 'number', value })
              }}
            >
              <span className="cell__digit">{value}</span>
              {picked ? <ChipStack amount={stake} /> : null}
            </button>
          )
        })}
      </div>

      <div className="felt__colors">
        {(['red', 'black'] as const).map((color) => (
          <button
            key={color}
            type="button"
            disabled={disabled}
            aria-pressed={isColorPicked(color)}
            className={`block block--${color}${isColorPicked(color) ? ' is-picked' : ''}`}
            onClick={() => {
              onSelect({ kind: 'color', value: color })
            }}
          >
            <span className="block__lozenge" aria-hidden="true" />
            <span className="block__name">{color === 'red' ? 'Rojo' : 'Negro'}</span>
            <span className="block__odds">×1,8</span>
            {isColorPicked(color) ? <ChipStack amount={stake} /> : null}
          </button>
        ))}
      </div>
    </div>
  )
}
