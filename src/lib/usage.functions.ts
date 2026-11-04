import { createServerFn } from '@tanstack/react-start'

/** Battement d'activité (toutes les 30 s, onglet visible et élève actif) : décompte du forfait gratuit. */
export const recordActivity = createServerFn({ method: 'POST' }).handler(
  async () => {
    const { setResponseHeader } = await import('@tanstack/react-start/server')
    setResponseHeader('Cache-Control', 'private, no-store')
    const { sessionUser } = await import('./session.server')
    const user = await sessionUser()
    if (!user) return null
    const { recordBeat } = await import('./access.server')
    return recordBeat(user.id)
  },
)
