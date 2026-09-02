import type { RouletteStatus } from '../api/types'

const LABELS: Record<RouletteStatus, string> = {
  created: 'Creada',
  open: 'Abierta',
  closed: 'Cerrada',
}

export function StatusBadge({ status }: { status: RouletteStatus }) {
  return (
    <span className={`badge badge--${status}`}>
      <span className="badge__dot" aria-hidden="true" />
      {LABELS[status]}
    </span>
  )
}
