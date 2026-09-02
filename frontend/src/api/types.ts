/**
 * Tipos del contrato de API v1 (docs/API_CONTRACT.md).
 * Cualquier cambio aquí debe acordarse antes con el backend.
 */

export type RouletteStatus = 'created' | 'open' | 'closed'
export type BetColor = 'red' | 'black'
export type BetType = 'number' | 'color'

/** Ruleta recién creada: POST /roulettes */
export interface CreatedRoulette {
  id: string
  status: RouletteStatus
  created_at: string
}

/** Elemento de GET /roulettes */
export interface RouletteSummary {
  id: string
  status: RouletteStatus
  created_at: string
  opened_at: string | null
  closed_at: string | null
  winning_number: number | null
  winning_color: BetColor | null
  bets_count: number
}

/** Respuesta de POST /roulettes/{id}/open */
export interface OpenRouletteResponse {
  success: boolean
  roulette_id: string
  status: RouletteStatus
  message: string
}

/** Apuesta registrada: POST /roulettes/{id}/bets */
export interface Bet {
  bet_id: string
  roulette_id: string
  user_id: string
  type: BetType
  number: number | null
  color: BetColor | null
  amount: number
  created_at: string
}

/** Cuerpo de una apuesta, discriminado por `type`. */
export type BetRequest =
  | { type: 'number'; number: number; amount: number }
  | { type: 'color'; color: BetColor; amount: number }

/** Resultado de una apuesta tras el cierre. */
export interface BetResult {
  bet_id: string
  user_id: string
  type: BetType
  number: number | null
  color: BetColor | null
  amount: number
  won: boolean
  /** Pago bruto devuelto al usuario (no la ganancia neta). */
  payout: number
}

/** Respuesta de POST /roulettes/{id}/close */
export interface CloseRouletteResponse {
  roulette_id: string
  status: RouletteStatus
  winning_number: number
  winning_color: BetColor
  closed_at: string
  total_bets: number
  total_amount_bet: number
  total_amount_paid: number
  results: BetResult[]
}

/** Respuesta de GET /roulettes/{id} */
export interface RouletteDetail extends RouletteSummary {
  bets: Bet[]
  results?: BetResult[] | null
}

/** Respuesta de GET /health */
export interface HealthResponse {
  status: string
  version: string
}
