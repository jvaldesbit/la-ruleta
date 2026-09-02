import type { BetColor } from '../api/types'
import { COLOR_LABEL } from '../lib/roulette'

interface WheelProps {
  number: number
  color: BetColor
  /** Cambia en cada sorteo para reiniciar la animación. */
  spinKey: string
}

/** Marcador del número ganador con un giro breve al aparecer. */
export function Wheel({ number, color, spinKey }: WheelProps) {
  return (
    <div className="wheel" key={spinKey}>
      <div className={`wheel__disc wheel__disc--${color}`}>
        <span className="wheel__number">{number}</span>
      </div>
      <p className="wheel__caption">
        Número ganador · <span className={`pill pill--${color}`}>{COLOR_LABEL[color]}</span>
      </p>
    </div>
  )
}
