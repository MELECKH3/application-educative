import { useEffect, useState } from 'react'

/** Horloge mise à jour côté client uniquement (null au rendu serveur pour éviter les écarts d'hydratation). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setNow(new Date()))
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => {
      cancelAnimationFrame(frame)
      clearInterval(id)
    }
  }, [intervalMs])
  return now
}
