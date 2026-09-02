import { Icon } from './Icon'

interface SoundToggleProps {
  muted: boolean
  onToggle: () => void
}

export function SoundToggle({ muted, onToggle }: SoundToggleProps) {
  return (
    <button
      type="button"
      className={muted ? 'speaker is-muted' : 'speaker'}
      aria-pressed={!muted}
      title={muted ? 'Sonido apagado' : 'Sonido encendido'}
      onClick={onToggle}
    >
      <Icon name={muted ? 'muted' : 'sound'} size={17} />
      <span className="sr-only">{muted ? 'Encender el sonido' : 'Apagar el sonido'}</span>
    </button>
  )
}
