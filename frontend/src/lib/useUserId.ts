import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'la-ruleta:user-id'

function readStoredUserId(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    // Modo privado o almacenamiento bloqueado: se sigue sin persistencia.
    return ''
  }
}

/** Id de usuario persistido en localStorage y enviado en `X-User-Id`. */
export function useUserId(): [string, (next: string) => void] {
  const [userId, setUserId] = useState<string>(readStoredUserId)

  useEffect(() => {
    try {
      if (userId.trim() === '') window.localStorage.removeItem(STORAGE_KEY)
      else window.localStorage.setItem(STORAGE_KEY, userId)
    } catch {
      // Sin persistencia disponible; el estado en memoria sigue funcionando.
    }
  }, [userId])

  const update = useCallback((next: string) => {
    setUserId(next)
  }, [])

  return [userId, update]
}
