import { Icon } from './Icon'
import { SoundToggle } from './SoundToggle'

type HealthState = 'checking' | 'ok' | 'down'

interface MarqueeProps {
  userId: string
  onUserIdChange: (next: string) => void
  health: HealthState
  muted: boolean
  onToggleSound: () => void
}

const HEALTH_TITLE: Record<HealthState, string> = {
  checking: 'Comprobando la conexión con la mesa',
  ok: 'Mesa conectada',
  down: 'Sin conexión con la mesa',
}

export function Marquee({ userId, onUserIdChange, health, muted, onToggleSound }: MarqueeProps) {
  return (
    <header className="marquee">
      <div className="marquee__sign">
        <span className="marquee__bulbs" aria-hidden="true" />
        <h1 className="marquee__title">La Ruleta</h1>
      </div>

      <div className="marquee__right">
        <label className="who">
          <Icon name="user" size={16} className="who__icon" />
          <span className="sr-only">Tu nombre de jugador</span>
          <input
            className="who__input"
            type="text"
            value={userId}
            placeholder="tu nombre"
            autoComplete="off"
            spellCheck={false}
            maxLength={32}
            onChange={(event) => {
              onUserIdChange(event.target.value)
            }}
          />
        </label>
        <SoundToggle muted={muted} onToggle={onToggleSound} />
        <span className={`lamp lamp--${health}`} title={HEALTH_TITLE[health]}>
          <span className="sr-only">{HEALTH_TITLE[health]}</span>
        </span>
      </div>
    </header>
  )
}
