import type { RouletteStatus, RouletteSummary } from '../api/types'
import { Icon } from './Icon'

const STATE_LABEL: Record<RouletteStatus, string> = {
  created: 'Cerrada al público',
  open: 'Admite apuestas',
  closed: 'Terminada',
}

interface TableRailProps {
  roulettes: RouletteSummary[]
  selectedId: string | null
  loading: boolean
  busyId: string | null
  spinning: boolean
  onSelect: (id: string) => void
  onCreate: () => void
  onOpen: (id: string) => void
  onClose: (id: string) => void
}

export function TableRail({
  roulettes,
  selectedId,
  loading,
  busyId,
  spinning,
  onSelect,
  onCreate,
  onOpen,
  onClose,
}: TableRailProps) {
  const selected = roulettes.find((roulette) => roulette.id === selectedId) ?? null
  const busy = spinning || (selected !== null && selected.id === busyId)

  return (
    <div className="tables">
      <div className="tables__rail" role="group" aria-label="Mesas">
        {roulettes.map((roulette, index) => (
          <button
            key={roulette.id}
            type="button"
            aria-pressed={roulette.id === selectedId}
            className={`plaque plaque--${roulette.status}${roulette.id === selectedId ? ' is-active' : ''}`}
            title={`Mesa ${roulette.id} · ${STATE_LABEL[roulette.status]}`}
            onClick={() => {
              onSelect(roulette.id)
            }}
          >
            <span className="plaque__n">{String(roulettes.length - index).padStart(2, '0')}</span>
            <span className="plaque__state" aria-hidden="true" />
            <span className="sr-only">{STATE_LABEL[roulette.status]}</span>
          </button>
        ))}
        <button type="button" className="plaque plaque--new" onClick={onCreate} disabled={loading}>
          <Icon name="plus" size={17} />
          <span className="sr-only">Abrir una mesa nueva</span>
        </button>
      </div>

      <div className="tables__actions">
        {selected !== null && selected.status === 'created' && !spinning ? (
          <button
            type="button"
            className="action action--open"
            disabled={busy}
            onClick={() => {
              onOpen(selected.id)
            }}
          >
            <Icon name="unlock" size={17} />
            {busy ? 'Abriendo…' : 'Abrir mesa'}
          </button>
        ) : null}
        {selected !== null && (selected.status === 'open' || spinning) ? (
          <button
            type="button"
            className="action action--spin"
            disabled={busy}
            onClick={() => {
              onClose(selected.id)
            }}
          >
            <Icon name="spin" size={17} />
            {busy ? 'Girando…' : 'Girar'}
          </button>
        ) : null}
        {selected !== null && selected.status === 'closed' && !spinning ? (
          <button type="button" className="action action--new" onClick={onCreate}>
            <Icon name="plus" size={17} />
            Mesa nueva
          </button>
        ) : null}
      </div>
    </div>
  )
}
