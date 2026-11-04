import { useEffect, useRef } from 'react'
import type { Access } from '@/lib/access'
import { recordActivity } from '@/lib/usage.functions'

const BEAT_MS = 30_000
const IDLE_MS = 2 * 60_000

/**
 * Décompte du forfait gratuit : un battement toutes les 30 s tant que l'onglet est visible
 * et que l'élève a bougé dans les 2 dernières minutes (pause automatique sinon).
 * Le serveur seul décide du temps restant ; `onAccess` reçoit l'accès recalculé.
 */
export function useActivityBeat(onAccess?: (access: Access | null) => void) {
  const cb = useRef(onAccess)
  useEffect(() => {
    cb.current = onAccess
  }, [onAccess])
  useEffect(() => {
    let last = Date.now()
    const touch = () => {
      last = Date.now()
    }
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove'] as const
    for (const e of events) window.addEventListener(e, touch, { passive: true })
    const id = window.setInterval(async () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - last > IDLE_MS) return
      try {
        cb.current?.(await recordActivity())
      } catch {
        // Réseau coupé : le prochain battement réessaiera.
      }
    }, BEAT_MS)
    return () => {
      window.clearInterval(id)
      for (const e of events) window.removeEventListener(e, touch)
    }
  }, [])
}
