import { useEffect, useState } from 'react'

function instant(): boolean {
  return typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Sube una cifra desde 0 hasta `target` al montar.
 * Con motion reducido arranca ya en el valor final.
 */
export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(() => (instant() ? target : 0))

  useEffect(() => {
    if (instant() || target === 0) return

    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      setValue(target * (1 - Math.pow(1 - progress, 3)))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
    }
  }, [target, duration])

  return value
}
