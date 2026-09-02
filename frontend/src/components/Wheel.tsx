import { useEffect, useState } from 'react'
import type { BetColor } from '../api/types'
import { colorOfNumber } from '../lib/roulette'
import { SECTOR_ANGLE, WHEEL_NUMBERS, angleForNumber, polar, sectorPath } from '../lib/wheel'

const OUTER = 150
const RIM = 138
const POCKET_OUT = 132
const POCKET_IN = 96
const HUB = 62
const SPIN_MS = 4200
const TURNS = 6

interface Phase {
  token: string | null
  angle: number
  moving: boolean
  settled: boolean
}

interface WheelProps {
  /** Número ganador, o null mientras la mesa no haya girado. */
  winning: number | null
  /** Cambia en cada sorteo: dispara el giro. */
  spinToken: string | null
  /** false para colocar la rueda sin animación (resultados ya conocidos). */
  animate: boolean
  onSettled?: () => void
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function Wheel({ winning, spinToken, animate, onSettled }: WheelProps) {
  const [phase, setPhase] = useState<Phase>({ token: null, angle: 0, moving: false, settled: false })

  // Ajuste de estado en render cuando cambia el sorteo (no en un efecto):
  // https://react.dev/learn/you-might-not-need-an-effect
  if (phase.token !== spinToken) {
    if (spinToken === null || winning === null) {
      setPhase({ token: spinToken, angle: phase.angle, moving: false, settled: false })
    } else if (!animate || reducedMotion()) {
      setPhase({ token: spinToken, angle: angleForNumber(winning), moving: false, settled: true })
    } else {
      const base = Math.ceil(phase.angle / 360) * 360
      setPhase({
        token: spinToken,
        angle: base + TURNS * 360 + angleForNumber(winning),
        moving: true,
        settled: false,
      })
    }
  }

  useEffect(() => {
    if (!phase.moving) return
    const timer = window.setTimeout(() => {
      setPhase((current) => (current.moving ? { ...current, moving: false, settled: true } : current))
    }, SPIN_MS + 120)
    return () => {
      window.clearTimeout(timer)
    }
  }, [phase.moving, phase.token])

  useEffect(() => {
    if (phase.settled) onSettled?.()
  }, [phase.settled, phase.token, onSettled])

  const { angle, moving, settled } = phase

  const easing = `transform ${String(SPIN_MS)}ms cubic-bezier(0.13, 0.72, 0.06, 1)`
  const spinStyle = { transform: `rotate(${String(angle)}deg)`, transition: moving ? easing : 'none' }
  const ballStyle = {
    transform: `rotate(${String(-angle * 1.55)}deg)`,
    transition: moving ? easing : 'none',
  }

  const label =
    winning === null
      ? 'La rueda todavía no ha girado'
      : `Número ganador ${String(winning)}, ${colorOfNumber(winning) === 'red' ? 'rojo' : 'negro'}`

  return (
    <div className={`wheel${moving ? ' is-spinning' : ''}${settled ? ' is-settled' : ''}`}>
      <svg viewBox="-160 -160 320 320" className="wheel__svg" role="img" aria-label={label}>
        <defs>
          <radialGradient id="wheelBrass" cx="38%" cy="30%">
            <stop offset="0%" stopColor="#f7dfa4" />
            <stop offset="55%" stopColor="#c79a3e" />
            <stop offset="100%" stopColor="#6d4c14" />
          </radialGradient>
          <radialGradient id="wheelHub" cx="36%" cy="28%">
            <stop offset="0%" stopColor="#f4e2b0" />
            <stop offset="60%" stopColor="#b98f33" />
            <stop offset="100%" stopColor="#4d360d" />
          </radialGradient>
          <radialGradient id="wheelLight" cx="42%" cy="24%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.55" />
          </radialGradient>
        </defs>

        <circle r={OUTER} fill="url(#wheelBrass)" />
        <circle r={RIM} fill="#0b0906" />

        <g style={spinStyle}>
          {WHEEL_NUMBERS.map((value, index) => {
            const from = index * SECTOR_ANGLE - SECTOR_ANGLE / 2
            const color: BetColor = colorOfNumber(value)
            const isWinner = settled && winning === value
            const text = polar((POCKET_OUT + POCKET_IN) / 2, index * SECTOR_ANGLE)
            return (
              <g key={value}>
                <path
                  d={sectorPath(POCKET_IN, POCKET_OUT, from, from + SECTOR_ANGLE)}
                  className={`wheel__pocket wheel__pocket--${color}${isWinner ? ' is-winner' : ''}`}
                />
                <text
                  x={text.x}
                  y={text.y}
                  className="wheel__digit"
                  textAnchor="middle"
                  dominantBaseline="central"
                  transform={`rotate(${String(index * SECTOR_ANGLE)} ${text.x.toFixed(2)} ${text.y.toFixed(2)})`}
                >
                  {value}
                </text>
              </g>
            )
          })}
          <circle r={POCKET_IN} fill="#120d08" />
          <circle r={HUB} fill="url(#wheelHub)" />
          <g stroke="#3b280a" strokeWidth="3" opacity="0.5">
            <line x1={-HUB} y1="0" x2={HUB} y2="0" />
            <line x1="0" y1={-HUB} x2="0" y2={HUB} />
          </g>
          <circle r="13" fill="#1b1206" stroke="#e7c877" strokeWidth="2" />
        </g>

        <g style={ballStyle}>
          <circle cx="0" cy={-(POCKET_IN + 14)} r="8" className="wheel__ball" />
        </g>

        <circle r={RIM} fill="url(#wheelLight)" pointerEvents="none" />
        <circle r={OUTER} fill="none" stroke="#2a1c06" strokeWidth="2" />
      </svg>

      <div className="wheel__pointer" aria-hidden="true">
        <svg viewBox="0 0 24 30" width="26" height="32">
          <defs>
            <linearGradient id="pointerBrass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f9e4ab" />
              <stop offset="55%" stopColor="#cb9f42" />
              <stop offset="100%" stopColor="#7a5718" />
            </linearGradient>
          </defs>
          <path d="M12 30 2 4a12 12 0 0 1 20 0Z" fill="url(#pointerBrass)" stroke="#3d2a08" strokeWidth="1.2" />
        </svg>
      </div>

      {winning !== null && settled ? (
        <p className={`wheel__result wheel__result--${colorOfNumber(winning)}`}>
          <span className="wheel__result-number">{winning}</span>
        </p>
      ) : null}
    </div>
  )
}
