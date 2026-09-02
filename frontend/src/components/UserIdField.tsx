interface UserIdFieldProps {
  userId: string
  onChange: (next: string) => void
}

export function UserIdField({ userId, onChange }: UserIdFieldProps) {
  const isEmpty = userId.trim() === ''

  return (
    <section className="panel panel--compact">
      <h2 className="panel__title">Tu identidad</h2>
      <label className="field">
        <span className="field__label">Identificador de usuario</span>
        <input
          className="field__input"
          type="text"
          value={userId}
          placeholder="p. ej. jugador-01"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            onChange(event.target.value)
          }}
        />
      </label>
      <p className={isEmpty ? 'hint hint--warn' : 'hint'}>
        {isEmpty
          ? 'Sin identificador no puedes apostar: el backend exige la cabecera X-User-Id.'
          : 'Se guarda en este navegador y viaja en la cabecera X-User-Id de cada apuesta.'}
      </p>
    </section>
  )
}
