import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  LESSONS_PER_STUDENT_PER_DAY as LESSONS_PER_STUDENT_PER_DAY_MAX,
  lessonRequestSchema,
} from './lecons'
import { explicationRequestSchema } from './explication'
import { lessonTestSubmitSchema } from './lecons'

async function lessonStudent() {
  const { setResponseHeader, getRequestUrl } = await import('@tanstack/react-start/server')
  setResponseHeader('Cache-Control', 'private, no-store')
  const { sessionUser } = await import('./session.server')
  const user = await sessionUser()
  if (!user) throw new Error('Ta session a expiré. Reconnecte-toi pour continuer.')
  const { getDatabase } = await import('@netlify/database')
  const [profile] = await getDatabase().sql<{ classe: string; serie: string }>`SELECT classe, serie FROM profiles WHERE user_id = ${user.id}`
  if (!profile) throw new Error('Termine ton profil élève pour voir tes leçons.')
  const { assertStudentAccess } = await import('./access.server')
  const access = await assertStudentAccess(user.id)
  const { normalizeSerie, matieresPour } = await import('./curriculum')
  const serie = normalizeSerie(profile.classe, profile.serie)
  return {
    user,
    access,
    classe: profile.classe,
    serie,
    matieres: matieresPour(profile.classe, serie).map((m) => m.id),
    origin: getRequestUrl().origin,
  }
}

const STATUS = (s: string) =>
  s === 'ready' ? ('ready' as const) : s === 'failed' ? ('failed' as const) : ('preparing' as const)

/** Leçons de la classe pour une matière, chapitres suggérés (issus des sujets) et rappels du jour. */
export const getLessonCatalog = createServerFn({ method: 'GET' })
  .validator(z.object({ matiere: z.string().max(40) }))
  .handler(async ({ data }) => {
    const { user, classe, serie, matieres, origin } = await lessonStudent()
    const matiere = matieres.includes(data.matiere) ? data.matiere : matieres[0]
    const { ensureProgramme } = await import('./contenu.server')
    const programme = await ensureProgramme(classe, serie, matiere, origin).catch(
      () => ({ status: 'failed' as const, chapitres: [] as string[] }),
    )
    const { getDatabase } = await import('@netlify/database')
    const { chapitreKey } = await import('./lecons')
    const db = getDatabase()
    const lessons = await db.sql<{ id: string; chapitre: string; titre: string | null; status: string; error: string | null }>`
      SELECT id, chapitre, titre, status, error FROM lessons
      WHERE classe = ${classe} AND serie = ${serie} AND matiere = ${matiere}
        AND NOT (status = 'failed' AND error = 'hors_programme')
      ORDER BY (status = 'ready') DESC, chapitre LIMIT 200`
    const chapters = await db.sql<{ chapitre: string }>`SELECT chapitre FROM subjects
      WHERE classe = ${classe} AND serie = ${serie} AND matiere = ${matiere}
      GROUP BY chapitre ORDER BY count(*) DESC LIMIT 40`
    const byKey = new Map(lessons.map((l) => [chapitreKey(l.chapitre), l]))
    const programmeKeys = new Set(programme.chapitres.map(chapitreKey))
    const known = new Set([...byKey.keys(), ...programmeKeys])
    const due = await db.sql<{ id: string; titre: string; matiere: string; next_at: string }>`
      SELECT l.id, l.titre, l.matiere, r.next_at::text FROM lesson_reviews r
      JOIN lessons l ON l.id = r.lesson_id
      WHERE r.user_id = ${user.id} AND r.next_at <= now() AND l.status = 'ready'
      ORDER BY r.next_at LIMIT 10`
    return {
      matiere,
      programme: {
        status: programme.status,
        chapitres: programme.chapitres.map((titre, i) => {
          const l = byKey.get(chapitreKey(titre))
          return {
            numero: i + 1,
            chapitre: titre,
            id: l?.id ?? null,
            titre: l?.titre ?? titre,
            status: l ? STATUS(l.status) : ('todo' as const),
          }
        }),
      },
      lessons: lessons.filter((l) => !programmeKeys.has(chapitreKey(l.chapitre))).map((l) => ({
        id: l.id,
        chapitre: l.chapitre,
        titre: l.titre ?? l.chapitre,
        status: STATUS(l.status),
      })),
      suggestions: chapters
        .map((c) => c.chapitre)
        .filter((c) => {
          const k = chapitreKey(c)
          if (known.has(k)) return false
          known.add(k)
          return true
        })
        .slice(0, 20),
      due: due.map((d) => ({ id: d.id, titre: d.titre, matiere: d.matiere })),
    }
  })

/** Ouvre la leçon d'un chapitre : réutilise celle de la classe, sinon le Professeur IA la rédige. */
export const requestLesson = createServerFn({ method: 'POST' })
  .validator(lessonRequestSchema)
  .handler(async ({ data }) => {
    const { user, access, classe, serie, matieres, origin } = await lessonStudent()
    const { limitesFor, isPremium } = await import('./access')
    const parJour = Math.min(LESSONS_PER_STUDENT_PER_DAY_MAX, limitesFor(access).nouvellesLeconsParJour)
    if (!matieres.includes(data.matiere)) throw new Error('Cette matière n’est pas au programme de ta classe.')
    const { getDatabase } = await import('@netlify/database')
    const { chapitreKey, LESSONS_PER_DAY_TOTAL } = await import('./lecons')
    const key = chapitreKey(data.chapitre)
    if (key.length < 3) throw new Error('Écris le nom du chapitre.')
    const db = getDatabase()
    const [existing] = await db.sql<{ id: string; status: string; error: string | null; updated_at: string }>`
      SELECT id, status, error, updated_at::text FROM lessons
      WHERE classe = ${classe} AND serie = ${serie} AND matiere = ${data.matiere} AND chapitre_key = ${key}`
    if (existing?.status === 'failed' && existing.error === 'hors_programme')
      throw new Error('Ce chapitre ne fait pas partie du programme de ta classe dans cette matière.')
    if (existing && existing.status !== 'failed') {
      // Rédaction bloquée depuis plus de 15 minutes : on la relance, en direct.
      if (existing.status !== 'ready' && Date.now() - Date.parse(existing.updated_at) > 15 * 60_000) {
        await db.sql`UPDATE lessons SET status = 'pending', updated_at = now() WHERE id = ${existing.id} AND status <> 'ready'`
        return { id: existing.id, direct: true }
      }
      // « pending » = réservée mais pas encore commencée : l'élève peut la faire rédiger en direct.
      return { id: existing.id, direct: existing.status === 'pending' }
    }
    const [quota] = await db.sql<{ mine: number; total: number }>`SELECT
        count(*) FILTER (WHERE requested_by = ${user.id})::int AS mine,
        count(*) FILTER (WHERE requested_by IS DISTINCT FROM 'programme')::int AS total
      FROM lessons WHERE updated_at > now() - interval '1 day'`
    // Les chapitres du programme officiel de la classe ne comptent pas dans le quota de l'élève.
    const { ensureProgramme } = await import('./contenu.server')
    const programme = await ensureProgramme(classe, serie, data.matiere, origin).catch(() => null)
    const auProgramme = !!programme?.chapitres.some((c) => chapitreKey(c) === key)
    if (!auProgramme && Number(quota?.mine ?? 0) >= parJour)
      throw new Error(
        isPremium(access)
          ? `Tu as déjà demandé ${parJour} nouvelles leçons aujourd’hui. Les leçons déjà prêtes restent ouvertes ; reviens demain pour d’autres chapitres.`
          : `Le forfait gratuit permet de demander ${parJour} nouvelle leçon par jour. Les leçons du programme restent ouvertes ; passe Premium pour en demander jusqu’à 5 par jour.`,
      )
    if (Number(quota?.total ?? 0) >= LESSONS_PER_DAY_TOTAL)
      throw new Error('Le Professeur IA a rédigé beaucoup de leçons aujourd’hui. Réessaie demain.')
    let id: string
    if (existing) {
      id = existing.id
      await db.sql`UPDATE lessons SET status = 'pending', error = NULL, requested_by = ${user.id}, updated_at = now()
        WHERE id = ${id}`
    } else {
      id = crypto.randomUUID()
      const [row] = await db.sql<{ id: string }>`INSERT INTO lessons (id, classe, serie, matiere, chapitre, chapitre_key, requested_by)
        VALUES (${id}, ${classe}, ${serie}, ${data.matiere}, ${data.chapitre}, ${key}, ${user.id})
        ON CONFLICT (classe, serie, matiere, chapitre_key) DO NOTHING RETURNING id`
      if (!row) {
        const [again] = await db.sql<{ id: string }>`SELECT id FROM lessons
          WHERE classe = ${classe} AND serie = ${serie} AND matiere = ${data.matiere} AND chapitre_key = ${key}`
        return { id: again.id, direct: false }
      }
    }
    // Rédaction express en direct par /api/lecon-direct ; sans navigateur, `getLesson` passe le relais
    // à la rédaction en arrière-plan.
    return { id, direct: true }
  })

/** Une leçon (ou son état de rédaction). */
export const getLesson = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { classe, serie, origin } = await lessonStudent()
    const { findLesson, wakeContent } = await import('./contenu.server')
    const found = await findLesson(data.id)
    if (!found || found.classe !== classe || found.serie !== serie) return { status: 'missing' as const }
    if (found.status === 'pending') {
      // Réservée mais personne ne la rédige depuis 40 s (navigateur fermé) : l'arrière-plan prend le relais.
      const { getDatabase } = await import('@netlify/database')
      const { switchOn } = await import('./admin.server')
      if (!(await switchOn('coupure_ia'))) {
        const [stale] = await getDatabase().sql<{ id: string }>`UPDATE lessons SET updated_at = now()
          WHERE id = ${data.id} AND status = 'pending' AND updated_at < now() - interval '40 seconds' RETURNING id`
        if (stale) await wakeContent('lecon', stale.id, origin)
      }
    }
    if (found.lecon) return { status: 'ready' as const, lecon: found.lecon }
    if (found.status === 'failed')
      return { status: 'failed' as const, horsProgramme: found.error === 'hors_programme', chapitre: found.chapitre }
    // « direct » : réservée mais pas encore commencée, le navigateur peut la faire rédiger en direct.
    return { status: 'preparing' as const, chapitre: found.chapitre, direct: found.status === 'pending' }
  })

/**
 * « Explique-moi cette leçon » : explication du chapitre au niveau choisi, si la formule de l'élève
 * l'ouvre (Gratuit = Essentiel, Mensuel = + Détaillé, Trimestriel/essai = + Approfondi).
 * Rédigée une seule fois par leçon et par niveau en arrière-plan ; le navigateur rappelle jusqu'à « ready ».
 */
export const explainLesson = createServerFn({ method: 'POST' })
  .validator(explicationRequestSchema)
  .handler(async ({ data }) => {
    const { user, access, classe, serie, origin } = await lessonStudent()
    const { planOf, limitesFor, isPremium } = await import('./access')
    const { niveauxPour, EXPLICATION_INFO } = await import('./explication')
    const info = EXPLICATION_INFO[data.niveau]
    if (!niveauxPour(planOf(access)).includes(data.niveau))
      throw new Error(
        `L’explication ${info.label} fait partie de la formule ${info.formule}. Passe Premium pour la débloquer.`,
      )
    const { findLesson, wakeContent } = await import('./contenu.server')
    const found = await findLesson(data.leconId)
    if (!found?.lecon || found.classe !== classe || found.serie !== serie)
      throw new Error('Leçon introuvable.')
    const { getDatabase } = await import('@netlify/database')
    const db = getDatabase()
    const vue = `${data.leconId}:${data.niveau}`
    const [quota] = await db.sql<{ n: number; deja: boolean }>`SELECT
        count(DISTINCT mode)::int AS n, bool_or(mode = ${vue}) AS deja
      FROM ai_events WHERE user_id = ${user.id} AND kind = 'explication-vue'
        AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`
    const limite = limitesFor(access).explicationsParJour
    if (!quota?.deja && Number(quota?.n ?? 0) >= limite)
      throw new Error(
        isPremium(access)
          ? `Tu as ouvert ${limite} explications aujourd’hui. Reviens demain pour la suite.`
          : `Le forfait gratuit comprend ${limite} explications par jour. Elles reviennent à minuit, ou passe Premium pour en ouvrir davantage, en version détaillée.`,
      )
    const [row] = await db.sql<{ id: string; status: string; content: unknown; attempts: number; stale: boolean }>`
      SELECT id, status, content, attempts, updated_at < now() - interval '12 minutes' AS stale
      FROM lesson_explanations WHERE lesson_id = ${data.leconId} AND niveau = ${data.niveau}`
    if (row?.status === 'ready') {
      if (!quota?.deja)
        await db.sql`INSERT INTO ai_events (id, user_id, kind, mode, status)
          VALUES (${crypto.randomUUID()}, ${user.id}, 'explication-vue', ${vue}, 'ok')`
      const { explicationSchema } = await import('./explication')
      const content = explicationSchema.parse(
        typeof row.content === 'string' ? JSON.parse(row.content) : row.content,
      )
      return { status: 'ready' as const, explication: content }
    }
    const { switchOn } = await import('./admin.server')
    if (await switchOn('coupure_ia'))
      throw new Error('L’IA est momentanément en pause. Réessaie un peu plus tard.')
    if (!row) {
      const [created] = await db.sql<{ id: string }>`INSERT INTO lesson_explanations (id, lesson_id, niveau)
        VALUES (${crypto.randomUUID()}, ${data.leconId}, ${data.niveau})
        ON CONFLICT (lesson_id, niveau) DO NOTHING RETURNING id`
      if (created && !(await wakeContent('explication', created.id, origin))) {
        await db.sql`UPDATE lesson_explanations SET status = 'failed', updated_at = now() WHERE id = ${created.id}`
        throw new Error('Le Professeur IA n’a pas pu commencer. Réessaie dans un instant.')
      }
      return { status: 'preparing' as const }
    }
    if ((row.status === 'failed' || row.stale) && Number(row.attempts) < 4) {
      const [again] = await db.sql<{ id: string }>`UPDATE lesson_explanations
        SET status = 'pending', attempts = attempts + 1, updated_at = now()
        WHERE id = ${row.id} AND status <> 'ready' RETURNING id`
      if (again) await wakeContent('explication', again.id, origin)
      return { status: 'preparing' as const }
    }
    if (row.status === 'failed')
      throw new Error('Cette explication n’a pas pu être rédigée. Essaie un autre niveau ou reviens plus tard.')
    return { status: 'preparing' as const }
  })

/** Test de fin de leçon : celui de la leçon, ou rédigé tout de suite (une fois, partagé) pour une leçon plus ancienne. */
export const getLessonTest = createServerFn({ method: 'POST' })
  .validator(z.object({ leconId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { classe, serie } = await lessonStudent()
    const { findLesson, ensureLessonTest } = await import('./contenu.server')
    const lecon = (await findLesson(data.leconId))?.lecon
    if (!lecon || lecon.classe !== classe || lecon.serie !== serie) throw new Error('Leçon introuvable.')
    if (lecon.test?.length) return { test: lecon.test }
    const { switchOn } = await import('./admin.server')
    if (await switchOn('coupure_ia')) throw new Error('L’IA est momentanément en pause. Réessaie un peu plus tard.')
    try {
      return { test: await ensureLessonTest(lecon) }
    } catch {
      throw new Error('Le test n’a pas pu être préparé. Réessaie dans un instant.')
    }
  })

/**
 * Corrige le test de fin de leçon (réponses vérifiées côté serveur) et programme la révision :
 * 6/10 ou plus fait avancer d'un palier (J+1, J+3, J+7), sinon révision demain.
 */
export const submitLessonTest = createServerFn({ method: 'POST' })
  .validator(lessonTestSubmitSchema)
  .handler(async ({ data }) => {
    const { user, classe, serie } = await lessonStudent()
    const { findLesson } = await import('./contenu.server')
    const { nextReviewDays, scoreLessonTest } = await import('./lecons')
    const lecon = (await findLesson(data.leconId))?.lecon
    if (!lecon?.test?.length || lecon.classe !== classe || lecon.serie !== serie)
      throw new Error('Ce test est introuvable.')
    const score = scoreLessonTest(lecon.test, data.answers)
    let rappelDans = 1
    try {
      const { getDatabase } = await import('@netlify/database')
      const db = getDatabase()
      const [prev] = await db.sql<{ step: number }>`SELECT step FROM lesson_reviews
        WHERE user_id = ${user.id} AND lesson_id = ${lecon.id}`
      const step = score.note >= 6 ? (prev ? Number(prev.step) + 1 : 0) : 0
      rappelDans = score.note >= 6 ? nextReviewDays(step) : 1
      await db.sql`INSERT INTO lesson_reviews (user_id, lesson_id, step, last_note, last_at, next_at)
        VALUES (${user.id}, ${lecon.id}, ${step}, ${Math.round(score.note)}, now(), now() + make_interval(days => ${rappelDans}))
        ON CONFLICT (user_id, lesson_id) DO UPDATE SET step = EXCLUDED.step, last_note = EXCLUDED.last_note,
          last_at = now(), next_at = EXCLUDED.next_at`
    } catch {
      // Le rappel ne doit jamais empêcher l'élève de voir sa note.
    }
    return { ...score, rappelDans }
  })

/**
 * Pendant que l'élève étudie un chapitre du programme, le suivant est rédigé en arrière-plan
 * (programme officiel : hors quota de l'élève) pour s'ouvrir instantanément.
 */
export const prepareNextLesson = createServerFn({ method: 'POST' })
  .validator(z.object({ leconId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { classe, serie, origin } = await lessonStudent()
    const { getDatabase } = await import('@netlify/database')
    const { chapitreKey, PROGRAMME_REQUESTER } = await import('./lecons')
    const { wakeContent } = await import('./contenu.server')
    const { switchOn } = await import('./admin.server')
    if (await switchOn('coupure_ia')) return { prepared: false }
    const db = getDatabase()
    const [lesson] = await db.sql<{ matiere: string; chapitre_key: string }>`SELECT matiere, chapitre_key FROM lessons
      WHERE id = ${data.leconId} AND classe = ${classe} AND serie = ${serie}`
    if (!lesson) return { prepared: false }
    const [prog] = await db.sql<{ chapitres: unknown }>`SELECT chapitres FROM lesson_programmes
      WHERE classe = ${classe} AND serie = ${serie} AND matiere = ${lesson.matiere} AND status = 'ready'`
    const raw = typeof prog?.chapitres === 'string' ? JSON.parse(prog.chapitres) : prog?.chapitres
    const chapitres = Array.isArray(raw) ? raw.map(String) : []
    const index = chapitres.findIndex((c) => chapitreKey(c) === lesson.chapitre_key)
    const next = index >= 0 ? chapitres[index + 1] : undefined
    if (!next) return { prepared: false }
    const id = crypto.randomUUID()
    const [row] = await db.sql<{ id: string }>`INSERT INTO lessons (id, classe, serie, matiere, chapitre, chapitre_key, requested_by)
      VALUES (${id}, ${classe}, ${serie}, ${lesson.matiere}, ${next}, ${chapitreKey(next)}, ${PROGRAMME_REQUESTER})
      ON CONFLICT (classe, serie, matiere, chapitre_key) DO NOTHING RETURNING id`
    if (!row) return { prepared: false }
    if (!(await wakeContent('lecon', id, origin)))
      await db.sql`UPDATE lessons SET status = 'failed', error = 'generation', updated_at = now() WHERE id = ${id}`
    return { prepared: true }
  })
