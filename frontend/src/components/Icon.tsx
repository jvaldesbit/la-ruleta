export type IconName =
  | 'info'
  | 'plus'
  | 'unlock'
  | 'spin'
  | 'refresh'
  | 'close'
  | 'undo'
  | 'user'
  | 'sound'
  | 'muted'

const PATHS: Record<IconName, string> = {
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5v.5m0 3.5v5',
  plus: 'M12 5v14M5 12h14',
  unlock: 'M6 11h12v9H6zM9 11V7.5A3 3 0 0 1 15 7',
  spin: 'M20 12a8 8 0 1 1-2.6-5.9M20 4v3.5h-3.5',
  refresh: 'M20 12a8 8 0 1 1-2.6-5.9M20 4v3.5h-3.5',
  close: 'M6 6l12 12M18 6 6 18',
  undo: 'M4 9h11a5 5 0 0 1 0 10H9M4 9l4-4M4 9l4 4',
  user: 'M4 20c0-3.3 3.6-5 8-5s8 1.7 8 5M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  sound: 'M4 9.5h3L11 6v12L7 14.5H4zM15 9.5a4 4 0 0 1 0 5M18 7a8 8 0 0 1 0 10',
  muted: 'M4 9.5h3L11 6v12l-4-3.5H4zM16 10l5 4M21 10l-5 4',
}

interface IconProps {
  name: IconName
  size?: number
  className?: string
}

export function Icon({ name, size = 18, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
