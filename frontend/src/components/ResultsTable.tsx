import type { CloseRouletteResponse } from '../api/types'
import { COLOR_LABEL, netProfit } from '../lib/roulette'
import { formatMoney, formatSignedMoney } from '../lib/format'
import { Wheel } from './Wheel'

export function ResultsTable({ result }: { result: CloseRouletteResponse }) {
  const playersNet = result.total_amount_paid - result.total_amount_bet

  return (
    <section className="panel">
      <header className="panel__header">
        <h2 className="panel__title">Resultado del periodo</h2>
        <span className="panel__sub">Ruleta {result.roulette_id}</span>
      </header>

      <Wheel number={result.winning_number} color={result.winning_color} spinKey={result.closed_at} />

      <div className="totals">
        <div className="totals__item">
          <span className="totals__label">Apuestas</span>
          <span className="totals__value">{result.total_bets}</span>
        </div>
        <div className="totals__item">
          <span className="totals__label">Total apostado</span>
          <span className="totals__value">{formatMoney(result.total_amount_bet)}</span>
        </div>
        <div className="totals__item">
          <span className="totals__label">Total pagado</span>
          <span className="totals__value">{formatMoney(result.total_amount_paid)}</span>
        </div>
        <div className="totals__item">
          <span className="totals__label">Neto jugadores</span>
          <span className={playersNet >= 0 ? 'totals__value is-win' : 'totals__value is-loss'}>
            {formatSignedMoney(playersNet)}
          </span>
        </div>
      </div>

      {result.results.length === 0 ? (
        <p className="empty">El periodo se cerró sin apuestas.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Usuario</th>
                <th scope="col">Apuesta</th>
                <th scope="col" className="table__num">Monto</th>
                <th scope="col">Resultado</th>
                <th scope="col" className="table__num">Pago</th>
                <th scope="col" className="table__num">Ganancia / pérdida</th>
              </tr>
            </thead>
            <tbody>
              {result.results.map((bet) => {
                const net = netProfit(bet)
                return (
                  <tr key={bet.bet_id} className={bet.won ? 'is-win-row' : undefined}>
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
                    <td>
                      <span className={bet.won ? 'tag tag--win' : 'tag tag--loss'}>
                        {bet.won ? 'Ganada' : 'Perdida'}
                      </span>
                    </td>
                    <td className="table__num">{formatMoney(bet.payout)}</td>
                    <td className={net >= 0 ? 'table__num is-win' : 'table__num is-loss'}>
                      {formatSignedMoney(net)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>Totales</td>
                <td className="table__num">{formatMoney(result.total_amount_bet)}</td>
                <td />
                <td className="table__num">{formatMoney(result.total_amount_paid)}</td>
                <td className={playersNet >= 0 ? 'table__num is-win' : 'table__num is-loss'}>
                  {formatSignedMoney(playersNet)}
                </td>
              </tr>
            </tfoot>
          </table>
          <p className="hint">
            «Pago» es el importe bruto devuelto al jugador; la última columna es su ganancia neta,
            es decir el pago menos lo apostado.
          </p>
        </div>
      )}
    </section>
  )
}
