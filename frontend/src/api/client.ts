import { ApiError, defaultMessageForStatus, extractErrorMessage } from './errors'
import type {
  Bet,
  BetRequest,
  CloseRouletteResponse,
  CreatedRoulette,
  HealthResponse,
  OpenRouletteResponse,
  RouletteDetail,
  RouletteSummary,
} from './types'

/**
 * Base de la API. Por defecto ruta relativa: en producción nginx sirve el
 * estático y hace de proxy hacia el backend; en desarrollo lo hace Vite.
 * `VITE_API_BASE_URL` la sobrescribe si el backend vive en otro origen.
 */
export const API_BASE_URL: string = resolveBaseUrl(import.meta.env.VITE_API_BASE_URL)

export function resolveBaseUrl(configured: string | undefined): string {
  const trimmed = configured?.trim()
  if (trimmed === undefined || trimmed === '') return '/api/v1'
  return trimmed.replace(/\/+$/, '')
}

interface RequestOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  userId?: string
  signal?: AbortSignal
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, userId, signal } = options

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (userId !== undefined) headers['X-User-Id'] = userId

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new ApiError(0, 'No se pudo contactar con el servidor. ¿Está el backend levantado?', cause)
  }

  const payload = await readJson(response)

  if (!response.ok) {
    throw new ApiError(
      response.status,
      extractErrorMessage(payload, defaultMessageForStatus(response.status)),
      payload,
    )
  }

  return payload as T
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (text.trim() === '') return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

export const api = {
  health: (signal?: AbortSignal): Promise<HealthResponse> =>
    apiRequest<HealthResponse>('/health', { signal }),

  listRoulettes: (signal?: AbortSignal): Promise<RouletteSummary[]> =>
    apiRequest<RouletteSummary[]>('/roulettes', { signal }),

  getRoulette: (rouletteId: string, signal?: AbortSignal): Promise<RouletteDetail> =>
    apiRequest<RouletteDetail>(`/roulettes/${encodeURIComponent(rouletteId)}`, { signal }),

  createRoulette: (): Promise<CreatedRoulette> =>
    apiRequest<CreatedRoulette>('/roulettes', { method: 'POST' }),

  openRoulette: (rouletteId: string): Promise<OpenRouletteResponse> =>
    apiRequest<OpenRouletteResponse>(`/roulettes/${encodeURIComponent(rouletteId)}/open`, {
      method: 'POST',
    }),

  closeRoulette: (rouletteId: string): Promise<CloseRouletteResponse> =>
    apiRequest<CloseRouletteResponse>(`/roulettes/${encodeURIComponent(rouletteId)}/close`, {
      method: 'POST',
    }),

  placeBet: (rouletteId: string, userId: string, bet: BetRequest): Promise<Bet> =>
    apiRequest<Bet>(`/roulettes/${encodeURIComponent(rouletteId)}/bets`, {
      method: 'POST',
      body: bet,
      userId,
    }),
}
