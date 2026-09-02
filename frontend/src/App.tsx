import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api/client'
import { ApiError } from './api/errors'
import type { CloseRouletteResponse, RouletteDetail, RouletteSummary } from './api/types'
import type { ChipValue } from './lib/chips'
import {
  EMPTY_SLIP,
  addSlipChip,
  chipExceedsCap,
  clearSlipAmount,
  pickSlip,
  restoreSlip,
  setSlipExact,
  slipAmountText,
  slipStake,
  submitSlip,
  undoSlipChip,
} from './lib/betSlip'
import { formatMoney } from './lib/format'
import { MAX_AMOUNT } from './lib/roulette'
import { isMuted, playSound, primeAudio, setMuted, soundSupported } from './lib/sound'
import { useUserId } from './lib/useUserId'
import { validateBet } from './lib/validation'
import { BetsStrip } from './components/BetsStrip'
import { BettingLayout } from './components/BettingLayout'
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
  const [muted, setMutedState] = useState(() => isMuted() || !soundSupported())
  /** Qué tocar cuando la rueda frene, decidido al cerrar la mesa. */
  const outcome = useRef<'win' | 'lose' | null>(null)

  const [roulettes, setRoulettes] = useState<RouletteSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<RouletteDetail | null>(null)
  const [closeResult, setCloseResult] = useState<CloseRouletteResponse | null>(null)

  const [slip, setSlip] = useState(EMPTY_SLIP)

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

  const stake = slipStake(slip)
  const { selection } = slip

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
    const prime = () => {
      primeAudio()
    }
    window.addEventListener('pointerdown', prime, { once: true })
    window.addEventListener('keydown', prime, { once: true })
    return () => {
      window.removeEventListener('pointerdown', prime)
      window.removeEventListener('keydown', prime)
    }
  }, [])

  const toggleSound = useCallback(() => {
    const next = !muted
    primeAudio()
    setMuted(next)
    setMutedState(next)
    // Al encenderlo suena una ficha: se oye de inmediato que está vivo.
    if (!next) playSound('chip')
  }, [muted])

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

  /** La mesa no se refresca hasta que la rueda frena: así no se adelanta el final. */
  const pendingRefresh = useRef<string | null>(null)

  const handleSettled = useCallback(() => {
    setSpinning(false)
    setRevealed(true)
    playSound('stop')
    if (outcome.current !== null) {
      const won = outcome.current === 'win'
      outcome.current = null
      window.setTimeout(() => {
        playSound(won ? 'win' : 'lose')
      }, 260)
      if (won) {
        setFlash(true)
        window.setTimeout(() => {
          setFlash(false)
        }, 1400)
      }
    }
    const pending = pendingRefresh.current
    if (pending === null) return
    pendingRefresh.current = null
    void (async () => {
      await loadRoulettes()
      await loadDetail(pending)
    })()
  }, [loadRoulettes, loadDetail])

  const handleSelectTable = useCallback((id: string) => {
    setSelectedId(id)
    setSlip(EMPTY_SLIP)
    setFormError(null)
    setRevealed(true)
    setSpinning(false)
    // El giro solo se anima la vez que ocurre: al volver a una mesa ya cerrada
    // el resultado se coloca sin repetir la animación.
    setCloseResult((current) => (current !== null && current.roulette_id === id ? current : null))
  }, [])

  const handleCreate = useCallback(() => {
    void (async () => {
      try {
        const created = await api.createRoulette()
        setCloseResult(null)
        setSlip(EMPTY_SLIP)
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
          setSlip(EMPTY_SLIP)
          playSound('spin')
          const mine = response.results.some((bet) => bet.won && bet.user_id === userId.trim())
          outcome.current = mine ? 'win' : 'lose'
          pendingRefresh.current = rouletteId
        } catch (cause) {
          setSpinning(false)
          setRevealed(true)
          pushToast('error', describeError(cause))
        } finally {
          setBusyId(null)
        }
      })()
    },
    [pushToast, userId],
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
    const amountText = slipAmountText(slip)
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

    // La mesa se libera aquí, no cuando conteste el servidor: el jugador puede
    // encadenar apuestas sin que se le pierdan los clics.
    const enviada = slip
    setSlip(submitSlip())
    playSound('place')

    void (async () => {
      setPlacing(true)
      try {
        await api.placeBet(selectedId, userId.trim(), checked.bet)
      } catch (cause) {
        // Devolvemos las fichas, salvo que ya haya empezado otra apuesta.
        setSlip((current) => restoreSlip(current, enviada))
        setFormError(describeError(cause))
        return
      } finally {
        setPlacing(false)
      }
      // Refrescos en segundo plano: no bloquean el tapete.
      await loadRoulettes()
      await loadDetail(selectedId)
    })()
  }, [slip, selection, selectedId, blockedReason, userId, loadRoulettes, loadDetail])

  const addStackChip = useCallback(
    (value: ChipValue) => {
      if (chipExceedsCap(slip, value)) {
        setFormError(`El tope por apuesta son ${formatMoney(MAX_AMOUNT)}.`)
        return
      }
      setFormError(null)
      playSound('chip')
      setSlip((current) => addSlipChip(current, value))
    },
    [slip],
  )

  return (
    <div className={`table${flash ? ' is-flashing' : ''}`}>
      <div className="table__spot" aria-hidden="true" />
      <Toasts items={toasts} onDismiss={dismissToast} />

      <div className="table__inner">
        <Marquee
          userId={userId}
          onUserIdChange={setUserId}
          health={health}
          muted={muted}
          onToggleSound={toggleSound}
        />

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
              spinning={spinning}
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
              disabled={bettingClosed || spinning}
              onSelect={(next) => {
                setSlip((current) => pickSlip(current, next))
                setFormError(null)
              }}
            />

            <ChipRail
              stack={slip.stack}
              stake={stake}
              disabled={bettingClosed || spinning}
              exact={slip.exact}
              onAdd={addStackChip}
              onUndo={() => {
                setSlip(undoSlipChip)
              }}
              onClear={() => {
                setSlip(clearSlipAmount)
              }}
              onSetExact={(value) => {
                setFormError(null)
                setSlip((current) => setSlipExact(current, value))
              }}
            />

            <div className="place">
              <button
                type="button"
                className="place__go"
                disabled={blockedReason !== null || placing || spinning}
                onClick={handleBet}
              >
                Apostar {formatMoney(stake)}
              </button>
              {formError !== null ? (
                <p className="place__error" role="alert">
                  {formError}
                </p>
              ) : blockedReason !== null ? (
                <p className="place__reason">{blockedReason}</p>
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
