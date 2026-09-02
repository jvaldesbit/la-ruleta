const currency = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const dateTime = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'medium',
})

export function formatMoney(value: number): string {
  return currency.format(value)
}

/** Igual que `formatMoney` pero con signo explícito, para ganancias y pérdidas. */
export function formatSignedMoney(value: number): string {
  const formatted = formatMoney(Math.abs(value))
  if (value > 0) return `+${formatted}`
  if (value < 0) return `−${formatted}`
  return formatted
}

export function formatDateTime(value: string | null): string {
  if (value === null) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return dateTime.format(parsed)
}

/** Identificador corto para no ocupar toda la fila con un UUID. */
export function shortId(id: string): string {
  return id.length <= 10 ? id : `${id.slice(0, 8)}…`
}
