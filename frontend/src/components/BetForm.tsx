import { useState } from 'react'
import type { FormEvent } from 'react'
import type { BetColor, BetRequest, RouletteSummary } from '../api/types'
import { COLOR_LABEL, COLOR_MULTIPLIER, MAX_AMOUNT, NUMBER_MULTIPLIER, colorOfNumber } from '../lib/roulette'
import { formatMoney } from '../lib/format'
import type { BetDraft, BetFieldErrors } from '../lib/validation'
import { validateBet, validateUserId } from '../lib/validation'

interface BetFormProps {
  roulette: RouletteSummary | null
  userId: string
  submitting: boolean
  onSubmit: (bet: BetRequest) => void
}

const INITIAL_DRAFT: BetDraft = { type: 'number', number: '0', color: 'red', amount: '100' }

export function BetForm({ roulette, userId, submitting, onSubmit }: BetFormProps) {
  const [draft, setDraft] = useState<BetDraft>(INITIAL_DRAFT)
  const [errors, setErrors] = useState<BetFieldErrors>({})

  const userIdError = validateUserId(userId)
  const noRoulette = roulette === null
  const notOpen = roulette !== null && roulette.status !== 'open'
  const blocked = userIdError !== null || noRoulette || notOpen

  const parsedNumber = Number(draft.number)
  const previewNumberColor =
    draft.type === 'number' && Number.isInteger(parsedNumber) && parsedNumber >= 0 && parsedNumber <= 36
      ? colorOfNumber(parsedNumber)
      : null

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = validateBet(draft)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    onSubmit(result.bet)
  }

  return (
    <section className="panel">
      <header className="panel__header">
        <h2 className="panel__title">Apostar</h2>
        {roulette !== null ? <span className="panel__sub">Ruleta {roulette.id}</span> : null}
      </header>

      {blocked ? (
        <p className="hint hint--warn" role="status">
          {userIdError ??
            (noRoulette
              ? 'Selecciona una ruleta de la lista para apostar.'
              : 'La ruleta seleccionada no está abierta. Ábrela para aceptar apuestas.')}
        </p>
      ) : null}

      <form className="bet-form" onSubmit={handleSubmit}>
        <fieldset className="bet-form__fieldset" disabled={blocked || submitting}>
          <legend className="field__label">Tipo de apuesta</legend>
          <div className="segmented">
            <button
              type="button"
              className={draft.type === 'number' ? 'segmented__item is-active' : 'segmented__item'}
              aria-pressed={draft.type === 'number'}
              onClick={() => {
                setDraft((prev) => ({ ...prev, type: 'number' }))
              }}
            >
              Número (×{NUMBER_MULTIPLIER})
            </button>
            <button
              type="button"
              className={draft.type === 'color' ? 'segmented__item is-active' : 'segmented__item'}
              aria-pressed={draft.type === 'color'}
              onClick={() => {
                setDraft((prev) => ({ ...prev, type: 'color' }))
              }}
            >
              Color (×{COLOR_MULTIPLIER})
            </button>
          </div>

          {draft.type === 'number' ? (
            <label className="field">
              <span className="field__label">Número (0 a 36)</span>
              <input
                className="field__input"
                type="number"
                min={0}
                max={36}
                step={1}
                value={draft.number}
                onChange={(event) => {
                  setDraft((prev) => ({ ...prev, number: event.target.value }))
                }}
              />
              {previewNumberColor !== null ? (
                <span className={`pill pill--${previewNumberColor}`}>
                  Este número es {COLOR_LABEL[previewNumberColor].toLowerCase()}
                </span>
              ) : null}
              {errors.number !== undefined ? <span className="field__error">{errors.number}</span> : null}
            </label>
          ) : (
            <div className="field">
              <span className="field__label">Color</span>
              <div className="color-choice">
                {(['red', 'black'] as const).map((color: BetColor) => (
                  <button
                    key={color}
                    type="button"
                    className={
                      draft.color === color
                        ? `color-choice__item color-choice__item--${color} is-active`
                        : `color-choice__item color-choice__item--${color}`
                    }
                    aria-pressed={draft.color === color}
                    onClick={() => {
                      setDraft((prev) => ({ ...prev, color }))
                    }}
                  >
                    {COLOR_LABEL[color]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="field">
            <span className="field__label">Monto (máximo {formatMoney(MAX_AMOUNT)})</span>
            <input
              className="field__input"
              type="number"
              min={0.01}
              max={MAX_AMOUNT}
              step={0.01}
              value={draft.amount}
              onChange={(event) => {
                setDraft((prev) => ({ ...prev, amount: event.target.value }))
              }}
            />
            {errors.amount !== undefined ? <span className="field__error">{errors.amount}</span> : null}
          </label>

          <button type="submit" className="btn btn--primary btn--block">
            {submitting ? 'Enviando apuesta…' : 'Confirmar apuesta'}
          </button>
        </fieldset>
      </form>
    </section>
  )
}
