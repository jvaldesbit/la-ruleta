import { Icon } from './Icon'

export interface ToastItem {
  id: number
  tone: 'error' | 'win'
  text: string
}

interface ToastsProps {
  items: ToastItem[]
  onDismiss: (id: number) => void
}

export function Toasts({ items, onDismiss }: ToastsProps) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className={`toast toast--${item.tone}`}>
          <span>{item.text}</span>
          <button
            type="button"
            className="toast__close"
            onClick={() => {
              onDismiss(item.id)
            }}
          >
            <Icon name="close" size={14} />
            <span className="sr-only">Cerrar aviso</span>
          </button>
        </div>
      ))}
    </div>
  )
}
