import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api/client'
import { ApiError } from './api/errors'
import type { CloseRouletteResponse, RouletteDetail, RouletteSummary } from './api/types'
import { addChip, sum } from './lib/chips'
import type { ChipValue } from './lib/chips'
import { formatMoney } from './lib/format'
import { useUserId } from './lib/useUserId'
import { validateBet } from './lib/validation'
import { BetsStrip } from './components/BetsStrip'
import { BettingLayout } from './components/BettingLayout'
import type { Selection } from './components/BettingLayout'
import { ChipRail } from './components/ChipRail'
import { InfoTip } from './components/InfoTip'
import { Marquee } from './components/Marquee'
import { Scoreboard } from './components/Scoreboard'
import { TableRail } from './components/TableRail'
import { Toasts } from './components/Toasts'
import type { ToastItem } from './components/Toasts'
import { Wheel } from './components/Wheel'

type HealthState = 'checking' | 'ok' | 'down'

function describeError(cause: unknown): string {
  if (cause instanceof ApiError) return cause.message
  if (cause instanceof Error) return cause.message
  return 'Algo ha ido mal en la mesa.'
}

export function App() {
  const [userId, setUserId] = useUserId()
  const [health, setHealth] = useState<HealthState>('checking')

  const [roulettes, setRoulettes] = useState<RouletteSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<RouletteDetail | null>(null)
  const [closeResult, setCloseResult] = useState<CloseRouletteResponse | null>(null)

  const [stack, setStack] = useState<number[]>([])
  const [exact, setExact] = useState('')
  const [selection, setSelection] = useState<Selection | null>(null)

  const [busyId, setBusyId] = useState<string | null>(null)
  const [placing, setPlacing] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [revealed, setRevealed] = useState(true)
  const [flash, setFlash] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const toastId = useRef(0)

  const pushToast = useCallback((tone: ToastItem['tone'], text: string) => {
    toastId.current += 1
    const id = toastId.current
    setToasts((current) => [...current.slice(-2), { id, tone, text }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id))
    }, 6000)
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const selected = useMemo(
    () => roulettes.find((roulette) => roulette.id === selectedId) ?? null,
    [roulettes, selectedId],
  )

  const stake = useMemo(() => {
    const manual = exact.trim().replace(',', '.')
    if (manual !== '') {
      const parsed = Number(manual)
      return Number.isFinite(parsed) ? parsed : 0
    }
    return sum(stack)
  }, [exact, stack])

  const amountText = exact.trim() !== '' ? exact : String(sum(stack))

  const loadRoulettes = useCallback(async (): Promise<RouletteSummary[]> => {
    setLoading(true)
    try {
      const list = await api.listRoulettes()
      setRoulettes(list)
      return list
    } catch (cause) {
      pushToast('error', describeError(cause))
      return []
    } finally {
      setLoading(false)
    }
  }, [pushToast])

  const loadDetail = useCallback(
    async (rouletteId: string) => {
      try {
        setDetail(await api.getRoulette(rouletteId))
      } catch (cause) {
        setDetail(null)
        pushToast('error', describeError(cause))
      }
    },
    [pushToast],
  )

  useEffect(() => {
    void (async () => {
      try {
        await api.health()
        setHealth('ok')
      } catch {
        setHealth('down')
      }
    })()
  }, [])

  useEffect(() => {
    void (async () => {
      const list = await loadRoulettes()
      setSelectedId((current) => current ?? list[0]?.id ?? null)
    })()
  }, [loadRoulettes])

  useEffect(() => {
    if (selectedId === null) {
      setDetail(null)
      return
    }
    void loadDetail(selectedId)
  }, [selectedId, loadDetail])

  /** Resultado a pintar: el del giro recién hecho o el ya guardado de una mesa cerrada. */
  const shownResult = useMemo<CloseRouletteResponse | null>(() => {
    if (closeResult !== null && closeResult.roulette_id === selectedId) return closeResult
    if (
      detail !== null &&
      detail.id === selectedId &&
      detail.status === 'closed' &&
      detail.winning_number !== null &&
      detail.winning_color !== null
    ) {
      const results = detail.results ?? []
      return {
        roulette_id: detail.id,
        status: 'closed',
        winning_number: detail.winning_number,
        winning_color: detail.winning_color,
        closed_at: detail.closed_at ?? detail.id,
        total_bets: results.length,
        total_amount_bet: results.reduce((total, bet) => total + bet.amount, 0),
        total_amount_paid: results.reduce((total, bet) => total + bet.payout, 0),
        results,
      }
    }
    return null
  }, [closeResult, detail, selectedId])

  const isFreshSpin = closeResult !== null && closeResult.roulette_id === selectedId

  const handleSettled = useCallback(() => {
    setSpinning(false)
    setRevealed(true)
  }, [])

  const handleSelectTable = useCallback((id: string) => {
    setSelectedId(id)
    setSelection(null)
    setFormError(null)
    setRevealed(true)
    setSpinning(false)
  }, [])

  const handleCreate = useCallback(() => {
    void (async () => {
      try {
        const created = await api.createRoulette()
        setCloseResult(null)
        setSelection(null)
        setSelectedId(created.id)
        setRevealed(true)
        await loadRoulettes()
      } catch (cause) {
        pushToast('error', describeError(cause))
      }
    })()
  }, [loadRoulettes, pushToast])

  const handleOpen = useCallback(
    (rouletteId: string) => {
      void (async () => {
        setBusyId(rouletteId)
        try {
          await api.openRoulette(rouletteId)
          await loadRoulettes()
          await loadDetail(rouletteId)
        } catch (cause) {
          pushToast('error', describeError(cause))
        } finally {
          setBusyId(null)
        }
      })()
    },
    [loadRoulettes, loadDetail, pushToast],
  )

  const handleSpin = useCallback(
    (rouletteId: string) => {
      void (async () => {
        setBusyId(rouletteId)
        setSpinning(true)
        setRevealed(false)
        try {
          const response = await api.closeRoulette(rouletteId)
          setCloseResult(response)
          setSelection(null)
          const mine = response.results.some((bet) => bet.won && bet.user_id === userId.trim())
          if (mine) {
            window.setTimeout(() => {
              setFlash(true)
              window.setTimeout(() => {
                setFlash(false)
              }, 1400)
            }, 4300)
          }
          await loadRoulettes()
          await loadDetail(rouletteId)
        } catch (cause) {
          setSpinning(false)
          setRevealed(true)
          pushToast('error', describeError(cause))
        } finally {
          setBusyId(null)
        }
      })()
    },
    [loadRoulettes, loadDetail, pushToast, userId],
  )

  const blockedReason = useMemo(() => {
    if (userId.trim() === '') return 'Escribe tu nombre arriba'
    if (selected === null) return 'Elige una mesa'
    if (selected.status === 'created') return 'Abre la mesa'
    if (selected.status === 'closed') return 'Mesa terminada'
    if (selection === null) return 'Elige número o color'
    if (stake <= 0) return 'Pon fichas'
    return null
  }, [userId, selected, selection, stake])

  const bettingClosed = selected === null || selected.status !== 'open'

  const handleBet = useCallback(() => {
    if (selection === null || selectedId === null || blockedReason !== null) return
    const draft =
      selection.kind === 'number'
        ? { type: 'number' as const, number: String(selection.value), color: 'red' as const, amount: amountText }
        : { type: 'color' as const, number: '', color: selection.value, amount: amountText }

    const checked = validateBet(draft)
    if (!checked.ok) {
      setFormError(checked.errors.amount ?? checked.errors.number ?? 'Revisa la apuesta.')
      return
    }
    setFormError(null)

    void (async () => {
      setPlacing(true)
      try {
        await api.placeBet(selectedId, userId.trim(), checked.bet)
        setStack([])
        setExact('')
        setSelection(null)
        await loadRoulettes()
        await loadDetail(selectedId)
      } catch (cause) {
        setFormError(describeError(cause))
      } finally {
        setPlacing(false)
      }
    })()
  }, [selection, selectedId, blockedReason, amountText, userId, loadRoulettes, loadDetail])

  const addStackChip = useCallback((value: ChipValue) => {
    setExact('')
    setFormError(null)
    setStack((current) => addChip(current, value))
  }, [])

  return (
    <div className={`table${flash ? ' is-flashing' : ''}`}>
      <div className="table__spot" aria-hidden="true" />
      <Toasts items={toasts} onDismiss={dismissToast} />

      <div className="table__inner">
        <Marquee userId={userId} onUserIdChange={setUserId} health={health} />

        <div className="table__body">
          <aside className="pit">
            <Wheel
              winning={shownResult?.winning_number ?? null}
              spinToken={shownResult?.closed_at ?? null}
              animate={isFreshSpin}
              onSettled={handleSettled}
            />
            <TableRail
              roulettes={roulettes}
              selectedId={selectedId}
              loading={loading}
              busyId={busyId}
              onSelect={handleSelectTable}
              onCreate={handleCreate}
              onOpen={handleOpen}
              onClose={handleSpin}
            />
          </aside>

          <main className="layout">
            <BettingLayout
              selection={selection}
              stake={stake}
              disabled={bettingClosed || spinning || placing}
              onSelect={(next) => {
                setSelection(next)
                setFormError(null)
              }}
            />

            <ChipRail
              stack={stack}
              stake={stake}
              disabled={bettingClosed || spinning || placing}
              exact={exact}
              onAdd={addStackChip}
              onUndo={() => {
                setStack((current) => current.slice(0, -1))
              }}
              onClear={() => {
                setStack([])
                setExact('')
              }}
              onSetExact={(value) => {
                setStack([])
                setFormError(null)
                setExact(value)
              }}
            />

            <div className="place">
              <button
                type="button"
                className="place__go"
                disabled={blockedReason !== null || placing || spinning}
                onClick={handleBet}
              >
                {placing ? 'Colocando…' : blockedReason ?? `Apostar ${formatMoney(stake)}`}
              </button>
              {formError !== null ? (
                <p className="place__error" role="alert">
                  {formError}
                </p>
              ) : null}
            </div>

            {detail !== null && detail.status !== 'closed' ? <BetsStrip bets={detail.bets} /> : null}
            {shownResult !== null ? <Scoreboard result={shownResult} revealed={revealed} /> : null}
          </main>
        </div>

        <footer className="table__foot">
          <span>Número ×5 · Color ×1,8 · Tope 10.000</span>
          <InfoTip />
        </footer>
      </div>
    </div>
  )
}
