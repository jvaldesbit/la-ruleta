export function RuleNote() {
  return (
    <aside className="rule-note">
      <strong>Regla del enunciado:</strong> el color de un número se decide por su paridad —{' '}
      <span className="chip chip--red">par = rojo</span>{' '}
      <span className="chip chip--black">impar = negro</span>. Por tanto el <strong>0 es rojo</strong>,
      a diferencia de la ruleta real, donde es verde y los colores no siguen la paridad.
    </aside>
  )
}
