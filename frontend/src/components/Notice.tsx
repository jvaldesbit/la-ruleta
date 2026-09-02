import type { ReactNode } from 'react'

export type NoticeTone = 'error' | 'success' | 'info'

interface NoticeProps {
  tone: NoticeTone
  children: ReactNode
  onDismiss?: () => void
}

export function Notice({ tone, children, onDismiss }: NoticeProps) {
  return (
    <div className={`notice notice--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="notice__text">{children}</span>
      {onDismiss ? (
        <button type="button" className="notice__close" onClick={onDismiss} aria-label="Descartar">
          ×
        </button>
      ) : null}
    </div>
  )
}
