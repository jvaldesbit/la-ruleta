import type { CloseRouletteResponse } from '../api/types'
import { COLOR_LABEL, netProfit } from '../lib/roulette'
import { formatMoney, formatSignedMoney } from '../lib/format'
import { useCountUp } from '../lib/useCountUp'

interface ScoreboardProps {
  result: CloseRouletteResponse
  /** Solo se anima cuando la rueda ya ha frenado. */
  revealed: boolean
}

export function Scoreboard({ result, revealed }: ScoreboardProps) {
  // La región viva existe desde el principio para que el lector de pantalla
  // anuncie el resultado; el marcador entra dentro al frenar la rueda, que es
  // cuando debe arrancar el contador.
  return (
    <div className="board-slot" aria-live="polite">
      {revealed ? <Board result={result} /> : null}
    </div>
  )
}

function Board({ result }: { result: CloseRouletteResponse }) {
  const paid = useCountUp(result.total_amount_paid)
  const playersNet = result.total_amount_paid - result.total_amount_bet

  return (
    <section className="board">
      <div className="board__totals">
        <p className="board__stat">
          <span className="board__stat-label">Apostado</span>
          <span className="board__stat-value">{formatMoney(result.total_amount_bet)}</span>
        </p>
        <p className="board__stat board__stat--paid">
          <span className="board__stat-label">Pagado</span>
          <span className="board__stat-value">{formatMoney(paid)}</span>
        </p>
        <p className="board__stat">
          <span className="board__stat-label">Neto jugadores</span>
          <span className={playersNet >= 0 ? 'board__stat-value is-win' : 'board__stat-value is-loss'}>
            {formatSignedMoney(playersNet)}
          </span>
        </p>
      </div>

      {result.results.length === 0 ? (
        <p className="board__empty">Nadie apostó en esta vuelta.</p>
      ) : (
        <ol className="board__list">
          {result.results.map((bet) => {
            const net = netProfit(bet)
            return (
              <li key={bet.bet_id} className={bet.won ? 'line line--won' : 'line line--lost'}>
                <span className="line__who">{bet.user_id}</span>
                <span className="line__pick">
                  {bet.type === 'number' ? (
                    <span className={`token token--${bet.number !== null && bet.number % 2 === 0 ? 'red' : 'black'}`}>
                      {bet.number}
                    </span>
                  ) : bet.color !== null ? (
                    <span className={`token token--${bet.color}`}>{COLOR_LABEL[bet.color]}</span>
                  ) : null}
                </span>
                <span className="line__amount">{formatMoney(bet.amount)}</span>
                <span className="line__payout">{bet.won ? formatMoney(bet.payout) : '—'}</span>
                <span className={net >= 0 ? 'line__net is-win' : 'line__net is-loss'}>
                  {formatSignedMoney(net)}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
