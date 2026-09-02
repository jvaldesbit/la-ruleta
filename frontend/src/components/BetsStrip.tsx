import type { Bet } from '../api/types'
import { COLOR_LABEL, colorOfNumber } from '../lib/roulette'
import { formatMoney } from '../lib/format'

/** Apuestas ya aceptadas en la mesa, como fichas alineadas en el borde. */
export function BetsStrip({ bets }: { bets: Bet[] }) {
  if (bets.length === 0) return null

  return (
    <ul className="strip" aria-label="Apuestas en juego">
      {bets.map((bet) => (
        <li key={bet.bet_id} className="strip__item">
          {bet.type === 'number' && bet.number !== null ? (
            <span className={`token token--${colorOfNumber(bet.number)}`}>{bet.number}</span>
          ) : bet.color !== null ? (
            <span className={`token token--${bet.color}`}>{COLOR_LABEL[bet.color]}</span>
          ) : null}
          <span className="strip__amount">{formatMoney(bet.amount)}</span>
          <span className="strip__who">{bet.user_id}</span>
        </li>
      ))}
    </ul>
  )
}
