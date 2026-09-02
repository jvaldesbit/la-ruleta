import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api/client'
import { ApiError } from './api/errors'
import type { BetRequest, CloseRouletteResponse, RouletteDetail, RouletteSummary } from './api/types'
import { useUserId } from './lib/useUserId'
import { BetForm } from './components/BetForm'
import { BetsTable } from './components/BetsTable'
import { Notice } from './components/Notice'
import { ResultsTable } from './components/ResultsTable'
import { RouletteList } from './components/RouletteList'
import { RuleNote } from './components/RuleNote'
import { UserIdField } from './components/UserIdField'

type HealthState = 'checking' | 'ok' | 'down'

function describeError(cause: unknown): string {
  if (cause instanceof ApiError) return cause.message
  if (cause instanceof Error) return cause.message
  return 'Ha ocurrido un error inesperado.'
}

export function App() {
  const [userId, setUserId] = useUserId()

  const [roulettes, setRoulettes] = useState<RouletteSummary[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<RouletteDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [closeResult, setCloseResult] = useState<CloseRouletteResponse | null>(null)

  const [busyId, setBusyId] = useState<string | null>(null)
  const [submittingBet, setSubmittingBet] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [health, setHealth] = useState<HealthState>('checking')

  const selected = useMemo(
    () => roulettes.find((roulette) => roulette.id === selectedId) ?? null,
    [roulettes, selectedId],
  )

  const loadRoulettes = useCallback(async (): Promise<RouletteSummary[]> => {
    setListLoading(true)
    try {
      const list = await api.listRoulettes()
      setRoulettes(list)
      return list
    } catch (cause) {
      setError(describeError(cause))
      return []
    } finally {
      setListLoading(false)
    }
  }, [])

  const loadDetail = useCallback(async (rouletteId: string) => {
    setDetailLoading(true)
    try {
      setDetail(await api.getRoulette(rouletteId))
    } catch (cause) {
      setDetail(null)
      setError(describeError(cause))
    } finally {
      setDetailLoading(false)
    }
  }, [])

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

  const handleCreate = useCallback(() => {
    void (async () => {
      setError(null)
      try {
        const created = await api.createRoulette()
        setSuccess(`Ruleta creada (${created.id}).`)
        setSelectedId(created.id)
        setCloseResult(null)
        await loadRoulettes()
      } catch (cause) {
        setError(describeError(cause))
      }
    })()
  }, [loadRoulettes])

  const handleOpen = useCallback(
    (rouletteId: string) => {
      void (async () => {
        setError(null)
        setBusyId(rouletteId)
        try {
          const response = await api.openRoulette(rouletteId)
          setSuccess(response.message)
          await loadRoulettes()
          await loadDetail(rouletteId)
        } catch (cause) {
          setError(describeError(cause))
        } finally {
          setBusyId(null)
        }
      })()
    },
    [loadRoulettes, loadDetail],
  )

  const handleClose = useCallback(
    (rouletteId: string) => {
      void (async () => {
        setError(null)
        setBusyId(rouletteId)
        try {
          const response = await api.closeRoulette(rouletteId)
          setCloseResult(response)
          setSelectedId(rouletteId)
          setSuccess(`Ruleta cerrada. Número ganador: ${String(response.winning_number)}.`)
          await loadRoulettes()
          await loadDetail(rouletteId)
        } catch (cause) {
          setError(describeError(cause))
        } finally {
          setBusyId(null)
        }
      })()
    },
    [loadRoulettes, loadDetail],
  )

  const handleBet = useCallback(
    (bet: BetRequest) => {
      if (selectedId === null) return
      void (async () => {
        setError(null)
        setSubmittingBet(true)
        try {
          const placed = await api.placeBet(selectedId, userId.trim(), bet)
          setSuccess(
            placed.type === 'number'
              ? `Apuesta registrada al número ${String(placed.number ?? '')}.`
              : `Apuesta registrada al color ${placed.color === 'red' ? 'rojo' : 'negro'}.`,
          )
          await loadRoulettes()
          await loadDetail(selectedId)
        } catch (cause) {
          setError(describeError(cause))
        } finally {
          setSubmittingBet(false)
        }
      })()
    },
    [selectedId, userId, loadRoulettes, loadDetail],
  )

  const visibleCloseResult = closeResult !== null && closeResult.roulette_id === selectedId ? closeResult : null

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__logo" aria-hidden="true" />
          <div>
            <h1 className="app__title">La Ruleta</h1>
            <p className="app__tagline">Crea, abre, apuesta y cierra. Demo del MVP.</p>
          </div>
        </div>
        <span className={`health health--${health}`}>
          {health === 'checking' ? 'Comprobando API…' : health === 'ok' ? 'API conectada' : 'API no disponible'}
        </span>
      </header>

      <RuleNote />

      <div className="notices">
        {error !== null ? (
          <Notice
            tone="error"
            onDismiss={() => {
              setError(null)
            }}
          >
            {error}
          </Notice>
        ) : null}
        {success !== null ? (
          <Notice
            tone="success"
            onDismiss={() => {
              setSuccess(null)
            }}
          >
            {success}
          </Notice>
        ) : null}
      </div>

      <main className="app__grid">
        <div className="app__column">
          <UserIdField userId={userId} onChange={setUserId} />
          <RouletteList
            roulettes={roulettes}
            selectedId={selectedId}
            loading={listLoading}
            busyId={busyId}
            onSelect={(id) => {
              setSelectedId(id)
            }}
            onCreate={handleCreate}
            onOpen={handleOpen}
            onClose={handleClose}
            onRefresh={() => {
              void loadRoulettes()
            }}
          />
        </div>

        <div className="app__column">
          <BetForm roulette={selected} userId={userId} submitting={submittingBet} onSubmit={handleBet} />

          {selected !== null ? (
            <section className="panel">
              <header className="panel__header">
                <h2 className="panel__title">Apuestas del periodo</h2>
                <span className="panel__sub">
                  {detailLoading ? 'Cargando…' : `${String(detail?.bets.length ?? 0)} registradas`}
                </span>
              </header>
              <BetsTable bets={detail?.bets ?? []} />
            </section>
          ) : null}

          {visibleCloseResult !== null ? <ResultsTable result={visibleCloseResult} /> : null}
        </div>
      </main>

      <footer className="app__footer">
        Pagos brutos: acierto a número ×5, acierto a color ×1,8. Monto máximo por apuesta 10.000.
      </footer>
    </div>
  )
}
