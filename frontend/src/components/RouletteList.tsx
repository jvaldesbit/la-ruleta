import type { RouletteSummary } from '../api/types'
import { COLOR_LABEL } from '../lib/roulette'
import { formatDateTime, shortId } from '../lib/format'
import { StatusBadge } from './StatusBadge'

interface RouletteListProps {
  roulettes: RouletteSummary[]
  selectedId: string | null
  loading: boolean
  busyId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  onOpen: (id: string) => void
  onClose: (id: string) => void
  onRefresh: () => void
}

export function RouletteList({
  roulettes,
  selectedId,
  loading,
  busyId,
  onSelect,
  onCreate,
  onOpen,
  onClose,
  onRefresh,
}: RouletteListProps) {
  return (
    <section className="panel">
      <header className="panel__header">
        <h2 className="panel__title">Ruletas</h2>
        <div className="panel__actions">
          <button type="button" className="btn btn--ghost" onClick={onRefresh} disabled={loading}>
            {loading ? 'Cargando…' : 'Actualizar'}
          </button>
          <button type="button" className="btn btn--primary" onClick={onCreate}>
            Crear ruleta
          </button>
        </div>
      </header>

      {roulettes.length === 0 ? (
        <p className="empty">
          {loading ? 'Cargando ruletas…' : 'Todavía no hay ruletas. Crea la primera para empezar.'}
        </p>
      ) : (
        <ul className="roulette-list">
          {roulettes.map((roulette) => {
            const isSelected = roulette.id === selectedId
            const isBusy = roulette.id === busyId
            return (
              <li key={roulette.id}>
                <article className={isSelected ? 'roulette roulette--selected' : 'roulette'}>
                  <button
                    type="button"
                    className="roulette__pick"
                    aria-pressed={isSelected}
                    onClick={() => {
                      onSelect(roulette.id)
                    }}
                  >
                    <span className="roulette__id" title={roulette.id}>
                      {shortId(roulette.id)}
                    </span>
                    <StatusBadge status={roulette.status} />
                  </button>

                  <dl className="roulette__meta">
                    <div>
                      <dt>Apuestas</dt>
                      <dd>{roulette.bets_count}</dd>
                    </div>
                    <div>
                      <dt>Creada</dt>
                      <dd>{formatDateTime(roulette.created_at)}</dd>
                    </div>
                    {roulette.winning_number !== null && roulette.winning_color !== null ? (
                      <div>
                        <dt>Ganador</dt>
                        <dd>
                          <span className={`pill pill--${roulette.winning_color}`}>
                            {roulette.winning_number} · {COLOR_LABEL[roulette.winning_color]}
                          </span>
                        </dd>
                      </div>
                    ) : null}
                  </dl>

                  <div className="roulette__actions">
                    <button
                      type="button"
                      className="btn btn--small"
                      disabled={roulette.status !== 'created' || isBusy}
                      onClick={() => {
                        onOpen(roulette.id)
                      }}
                    >
                      Abrir
                    </button>
                    <button
                      type="button"
                      className="btn btn--small btn--danger"
                      disabled={roulette.status !== 'open' || isBusy}
                      onClick={() => {
                        onClose(roulette.id)
                      }}
                    >
                      Cerrar y sortear
                    </button>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
