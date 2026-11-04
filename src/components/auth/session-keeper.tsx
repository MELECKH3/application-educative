import { useEffect } from 'react'

/**
 * Garde la session ouverte tant que l'onglet est ouvert : la lecture du compte côté
 * navigateur démarre le renouvellement automatique du jeton (valable 1 h), et on le
 * vérifie de nouveau quand l'élève revient sur l'onglet après une pause.
 */
export function SessionKeeper() {
  useEffect(() => {
    let active = true
    const keepAlive = async () => {
      try {
        const { getUser, refreshSession } = await import('@netlify/identity')
        if (!active) return
        const user = await getUser()
        if (user) await refreshSession()
      } catch {
        // Hors ligne ou Identity indisponible : le serveur redirigera si besoin.
      }
    }
    void keepAlive()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void keepAlive()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  return null
}
