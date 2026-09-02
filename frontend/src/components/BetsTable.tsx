import type { Bet } from '../api/types'
import { COLOR_LABEL } from '../lib/roulette'
import { formatMoney, formatDateTime } from '../lib/format'

export function BetsTable({ bets }: { bets: Bet[] }) {
  if (bets.length === 0) {
    return <p className="empty">Aún no hay apuestas en esta ruleta.</p>
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Usuario</th>
            <th scope="col">Apuesta</th>
            <th scope="col" className="table__num">Monto</th>
            <th scope="col">Registrada</th>
          </tr>
        </thead>
        <tbody>
          {bets.map((bet) => (
            <tr key={bet.bet_id}>
              <td title={bet.bet_id}>{bet.user_id}</td>
              <td>
                {bet.type === 'number' ? (
                  <>
                    Número <strong>{bet.number}</strong>
                  </>
                ) : bet.color !== null ? (
                  <span className={`pill pill--${bet.color}`}>{COLOR_LABEL[bet.color]}</span>
                ) : (
                  '—'
                )}
              </td>
              <td className="table__num">{formatMoney(bet.amount)}</td>
              <td>{formatDateTime(bet.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
