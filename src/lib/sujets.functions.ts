import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

async function currentStudent() {
  const { setResponseHeader } = await import('@tanstack/react-start/server')
  setResponseHeader('Cache-Control', 'private, no-store')
  const { sessionUser } = await import('./session.server')
  const user = await sessionUser()
  if (!user)
    throw new Error('Ta session a expiré. Reconnecte-toi pour continuer.')
  const { getDatabase } = await import('@netlify/database')
  const [profile] = await getDatabase().sql<{
    classe: string
    serie: string
  }>`SELECT classe, serie FROM profiles WHERE user_id = ${user.id}`
  if (!profile)
    throw new Error('Termine ton profil élève pour voir tes sujets.')
  const { assertStudentAccess } = await import('./access.server')
  const access = await assertStudentAccess(user.id)
  const { limitesFor } = await import('./access')
  const { normalizeSerie } = await import('./curriculum')
  return {
    user,
    niveaux: limitesFor(access).niveaux,
    classe: profile.classe,
    serie: normalizeSerie(profile.classe, profile.serie),
  }
}

function lockSujet<T extends { niveau: number; enonce: string; bareme: string }>(
  sujet: T,
  niveaux: number[],
) {
  return niveaux.includes(sujet.niveau)
    ? { ...sujet, verrouille: false }
    : { ...sujet, enonce: '', bareme: '', verrouille: true }
}

async function origin() {
  const { getRequestUrl } = await import('@tanstack/react-start/server')
  return getRequestUrl().origin
}

/** Sujets programmés pour la classe de l'élève connecté (la classe est lue côté serveur). */
export const getClassSujets = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      matiere: z.string().max(40).optional(),
      niveau: z.number().int().min(1).max(4).optional(),
      page: z.number().int().min(0).max(1000).default(0),
      limit: z.number().int().min(1).max(30).default(24),
    }),
  )
  .handler(async ({ data }) => {
    const { classe, serie, niveaux } = await currentStudent()
    const { listForClass, ensureClassSubjects, classRunPending } =
      await import('./sujets.server')
    const { matieresPour } = await import('./curriculum')
    const res = await listForClass({
      classe,
      serie,
      matiere: data.matiere,
      niveau: data.niveau,
      limit: data.limit,
      offset: data.page * data.limit,
    })
    const preparing = await (async () => {
      try {
        return (
          (await ensureClassSubjects(classe, serie, await origin(), {
            matiere: res.matiere,
            parMatiere: res.parMatiere,
          })) || (await classRunPending(classe, serie, res.matiere))
        )
      } catch {
        return false
      }
    })()
    return {
      ...res,
      // Forfait gratuit : les sujets des niveaux Premium restent visibles (titre) mais leur énoncé est masqué.
      sujets: res.sujets.map((x) => lockSujet(x, niveaux)),
      niveauxOuverts: niveaux,
      classe,
      serie,
      matieres: matieresPour(classe, serie),
      preparing,
    }
  })

export const getSujet = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.string().min(1).max(100) }))
  .handler(async ({ data }) => {
    const { niveaux } = await currentStudent()
    const { findSujet } = await import('./sujets.server')
    const sujet = await findSujet(data.id)
    return sujet ? lockSujet(sujet, niveaux) : null
  })

/** Console admin : état réel de la Grande Actualisation. */
export const getRefreshOverview = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { requireAdmin } = await import('./billing.server')
    await requireAdmin()
    const { getDatabase } = await import('@netlify/database')
    const { getSetting } = await import('./sujets.server')
    const db = getDatabase()
    const runs =
      await db.sql`SELECT id, trigger, scope, status, created, failed, error, created_at::text, finished_at::text
    FROM refresh_runs ORDER BY created_at DESC LIMIT 10`
    const { activeClasses, dailyBudget } = await import('./generator.server')
    const { SUJETS_PAR_CLASSE, RENOUVELLEMENT_JOURS } =
      await import('./curriculum')
    const counts = await db.sql`SELECT classe, serie,
      count(*) FILTER (WHERE archived_at IS NULL)::int AS active,
      count(*) FILTER (WHERE archived_at IS NULL AND created_at > now() - make_interval(days => ${RENOUVELLEMENT_JOURS}))::int AS fresh,
      count(*) FILTER (WHERE archived_at IS NOT NULL)::int AS archived
    FROM subjects GROUP BY classe, serie`
    const byClass = new Map(counts.map((c) => [`${c.classe}|${c.serie}`, c]))
    const classes = await activeClasses()
    const perClass = classes.map((c) => {
      const row = byClass.get(`${c.classe}|${c.serie}`)
      return {
        classe: c.classe,
        serie: c.serie,
        active: Number(row?.active ?? 0),
        fresh: Number(row?.fresh ?? 0),
      }
    })
    const budget = await dailyBudget()
    const [content] = await db.sql`SELECT
      (SELECT count(*)::int FROM daily_quizzes WHERE day = ${new Date().toISOString().slice(0, 10)} AND status = 'ready') AS quizzes,
      (SELECT count(*)::int FROM lessons WHERE status = 'ready') AS lessons,
      (SELECT count(*)::int FROM subjects WHERE archived_at IS NOT NULL) AS archived`
    return {
      paused: (await getSetting('actualisation_pause')) === 'oui',
      target: SUJETS_PAR_CLASSE,
      renewDays: RENOUVELLEMENT_JOURS,
      quota: budget.quota,
      createdToday: budget.today,
      neededPerDay: Math.ceil(
        (classes.length * SUJETS_PAR_CLASSE) / RENOUVELLEMENT_JOURS,
      ),
      quizzesToday: Number(content?.quizzes ?? 0),
      lessonsReady: Number(content?.lessons ?? 0),
      archived: Number(content?.archived ?? 0),
      runs: runs.map((r) => ({
        id: String(r.id),
        trigger: String(r.trigger),
        scope: String(r.scope),
        status: String(r.status),
        created: Number(r.created),
        failed: Number(r.failed),
        error: r.error ? String(r.error) : null,
        createdAt: new Date(String(r.created_at)).toISOString(),
        finishedAt: r.finished_at
          ? new Date(String(r.finished_at)).toISOString()
          : null,
      })),
      perClass,
    }
  },
)

export const controlRefresh = createServerFn({ method: 'POST' })
  .validator(
    z.discriminatedUnion('action', [
      z.object({ action: z.literal('lancer') }),
      z.object({ action: z.literal('pause'), paused: z.boolean() }),
      z.object({ action: z.literal('annuler'), id: z.string().uuid() }),
      z.object({
        action: z.literal('quota'),
        value: z.number().int().min(0).max(5000),
      }),
    ]),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import('./billing.server')
    await requireAdmin()
    const { getDatabase } = await import('@netlify/database')
    const { queueRun, setSetting } = await import('./sujets.server')
    const db = getDatabase()
    if (data.action === 'pause') {
      await setSetting('actualisation_pause', data.paused ? 'oui' : 'non')
      return { ok: true }
    }
    if (data.action === 'quota') {
      await setSetting('actualisation_quota_jour', String(data.value))
      return { ok: true }
    }
    if (data.action === 'annuler') {
      await db.sql`UPDATE refresh_runs SET status = 'cancelled', finished_at = now()
        WHERE id = ${data.id} AND status IN ('queued', 'running')`
      return { ok: true }
    }
    const [active] = await db.sql`SELECT count(*)::int AS n FROM refresh_runs
      WHERE scope = 'toutes' AND status IN ('queued', 'running') AND created_at > now() - interval '20 minutes'`
    if (Number(active?.n ?? 0) > 0)
      throw new Error('Une actualisation est déjà en cours.')
    const id = await queueRun({
      trigger: 'admin',
      scope: 'toutes',
      origin: await origin(),
    })
    if (!id) throw new Error('L’actualisation n’a pas pu démarrer. Réessaie.')
    return { ok: true }
  })
