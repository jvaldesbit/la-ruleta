import { useId } from 'react'
import { Icon } from './Icon'

/** Regla de paridad del enunciado, escondida tras un icono. */
export function InfoTip() {
  const id = useId()
  return (
    <span className="tip">
      <button type="button" className="tip__button" aria-describedby={id}>
        <Icon name="info" size={15} />
        <span className="sr-only">Cómo se decide el color</span>
      </button>
      <span role="tooltip" id={id} className="tip__bubble">
        Par <em className="tip__red">rojo</em>, impar <em className="tip__black">negro</em>. El 0 es par, así
        que es rojo: la ruleta real no funciona así, pero el enunciado sí.
      </span>
    </span>
  )
}
