/** Error de API con el código de estado y el mensaje real del servidor. */
export class ApiError extends Error {
  readonly status: number
  readonly payload: unknown

  constructor(status: number, message: string, payload?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Extrae el mensaje de un cuerpo de error.
 *
 * El contrato dice `{"detail": "..."}`, pero FastAPI también devuelve
 * `detail` como lista de errores de validación (422) o como objeto
 * (por ejemplo el 409 de apertura, con `success: false`). Se cubren
 * las tres formas y se cae a un texto por defecto si no hay nada legible.
 */
export function extractErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'string' && payload.trim() !== '') return payload

  if (!isRecord(payload)) return fallback

  const { detail } = payload

  if (typeof detail === 'string' && detail.trim() !== '') return detail

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => (isRecord(item) && typeof item.msg === 'string' ? item.msg : null))
      .filter((msg): msg is string => msg !== null)
    if (messages.length > 0) return messages.join('. ')
  }

  if (isRecord(detail)) {
    for (const key of ['message', 'detail', 'error'] as const) {
      const value = detail[key]
      if (typeof value === 'string' && value.trim() !== '') return value
    }
  }

  for (const key of ['message', 'error'] as const) {
    const value = payload[key]
    if (typeof value === 'string' && value.trim() !== '') return value
  }

  return fallback
}

/** Mensaje por defecto legible para cada código de estado conocido. */
export function defaultMessageForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'Petición inválida. Revisa el identificador de usuario.'
    case 404:
      return 'La ruleta no existe.'
    case 409:
      return 'La ruleta no está en el estado necesario para esta operación.'
    case 422:
      return 'Los datos de la apuesta no son válidos.'
    default:
      return `Error del servidor (${String(status)}).`
  }
}
