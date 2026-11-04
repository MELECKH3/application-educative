import { createFileRoute } from '@tanstack/react-router'

// Rédaction express d'une leçon, diffusée au fil de l'eau (une ligne JSON par mise à jour) :
// le 1er temps s'affiche en quelques secondes, la suite arrive pendant que l'élève lit.
// Seule une leçon réservée par `requestLesson` (statut « pending ») de la classe de l'élève est rédigée.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  })

export const Route = createFileRoute('/api/lecon-direct')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as { id?: unknown } | null
        const id = typeof body?.id === 'string' && /^[0-9a-f-]{36}$/.test(body.id) ? body.id : ''
        if (!id) return json({ type: 'error', message: 'Leçon introuvable.' }, 400)
        const { sessionUser } = await import('@/lib/session.server')
        const user = await sessionUser()
        if (!user) return json({ type: 'error', message: 'Ta session a expiré. Reconnecte-toi pour continuer.' }, 401)
        const { getDatabase } = await import('@netlify/database')
        const [profile] = await getDatabase().sql<{ classe: string; serie: string }>`SELECT classe, serie FROM profiles WHERE user_id = ${user.id}`
        if (!profile) return json({ type: 'error', message: 'Termine ton profil élève pour voir tes leçons.' }, 403)
        const { studentAccess } = await import('@/lib/access.server')
        const { ACCESS_BLOCKED_MESSAGE } = await import('@/lib/access')
        if ((await studentAccess(user.id))?.status === 'bloque')
          return json({ type: 'error', message: ACCESS_BLOCKED_MESSAGE }, 403)
        const { switchOn } = await import('@/lib/admin.server')
        if (await switchOn('coupure_ia')) return json({ type: 'wait' })
        const { normalizeSerie } = await import('@/lib/curriculum')
        const scope = { classe: profile.classe, serie: normalizeSerie(profile.classe, profile.serie) }
        const { writeLessonLive } = await import('@/lib/contenu.server')
        const origin = new URL(request.url).origin
        const encoder = new TextEncoder()
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            let open = true
            const send = (event: unknown) => {
              if (!open) return
              try {
                controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
              } catch {
                open = false
              }
            }
            send({ type: 'start' })
            const result = await writeLessonLive(id, scope, origin, (lecon) => send({ type: 'lecon', lecon })).catch(
              () => 'fallback' as const,
            )
            send({ type: result === 'busy' ? 'wait' : result })
            if (open) controller.close()
          },
        })
        return new Response(stream, {
          headers: {
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            'Cache-Control': 'private, no-store',
            'X-Accel-Buffering': 'no',
          },
        })
      },
    },
  },
})
