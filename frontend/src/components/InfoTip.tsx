import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from './Icon'

/** Regla de paridad del enunciado, escondida tras un icono. */
export function InfoTip() {
  const id = useId()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onPointer = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (box.current?.contains(event.target) === false) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  return (
    <span className={open ? 'tip is-open' : 'tip'} ref={box}>
      <button
        type="button"
        className="tip__button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen((current) => !current)
        }}
      >
        <Icon name="info" size={15} />
        <span className="sr-only">Cómo se decide el color de un número</span>
      </button>
      <span role="tooltip" id={id} className="tip__bubble" hidden={!open}>
        Par <em className="tip__red">rojo</em>, impar <em className="tip__black">negro</em>. El 0 es par, así
        que es rojo: la ruleta real no funciona así, pero el enunciado sí.
      </span>
    </span>
  )
}
