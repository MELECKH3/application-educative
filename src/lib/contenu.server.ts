import Anthropic from '@anthropic-ai/sdk'
import { getDatabase } from '@netlify/database'
import { parseModelJson } from './ai'
import { cycleOf, matieresPour, normalizeSerie, SERIES_PAR_CLASSE } from './curriculum'
import {
  AUTO_LESSONS_PER_NIGHT,
  PROGRAMME_REQUESTER,
  chapitreKey,
  cleanProgramme,
  lessonWriterPrompt,
  lessonWrittenSchema,
  programmePrompt,
  programmeSchema,
  toLessonContent,
  LIVE_MAX_TOKENS,
  assembleLiveLesson,
  cleanTest,
  lessonTestPrompt,
  lessonTestSchema,
  livePartPrompt,
  livePartSchemas,
  type LeconIA,
  type LivePart,
  type LiveParts,
} from './lecons'
import { LESSON_FAST_MODEL, LESSON_MODEL, LESSON_WRITER_MODEL, QUIZ_MODEL, generationParams } from './models'
import { QUIZ_QUESTIONS, cleanQuiz, quizPrompt, quizQuestionSchema, type QuizQuestion } from './quiz'

// Contenus rédigés par l'IA en arrière-plan : quiz du jour et leçons.
// Imports relatifs uniquement : ce module est aussi empaqueté dans les Netlify Functions.

let client: Anthropic | null = null
const anthropic = () => (client ??= new Anthropic())

export async function ask(
  model: string,
  system: string,
  user: string,
  maxTokens: number,
  kind: string,
  timeout = 600_000,
) {
  const message = await anthropic().messages.create(
    { model, ...generationParams(model, maxTokens), system, messages: [{ role: 'user', content: user }] },
    { timeout, maxRetries: 1 },
  )
  try {
    await getDatabase().sql`INSERT INTO ai_events (id, user_id, kind, mode, status, input_tokens, output_tokens)
      VALUES (${crypto.randomUUID()}, 'systeme', ${kind}, ${model}, 'ok',
        ${message.usage?.input_tokens ?? 0}, ${message.usage?.output_tokens ?? 0})`
  } catch {
    // Le journal des coûts ne bloque jamais la génération.
  }
  return message.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
}

/** Réveille la fonction d'arrière-plan pour un contenu en attente (identifiant créé en base). */
export async function wakeContent(
  kind: 'quiz' | 'lecon' | 'programme' | 'explication',
  id: string,
  origin: string,
) {
  try {
    const res = await fetch(new URL('/.netlify/functions/contenu-ia-background', origin), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, id }),
      signal: AbortSignal.timeout(10000),
    })
    return res.ok || res.status === 202
  } catch {
    return false
  }
}

export async function generateQuiz(id: string) {
  const db = getDatabase()
  const [quiz] = await db.sql<{ day: string; classe: string; serie: string }>`UPDATE daily_quizzes
    SET status = 'generating', updated_at = now()
    WHERE id = ${id} AND status = 'pending' RETURNING day, classe, serie`
  if (!quiz) return
  try {
    const allowed = matieresPour(quiz.classe, quiz.serie).map((m) => m.id)
    const raw = await ask(
      QUIZ_MODEL,
      quizPrompt(quiz.classe, quiz.serie, quiz.day),
      `Rédige les ${QUIZ_QUESTIONS} questions du quiz maintenant.`,
      6000,
      'quiz',
    )
    const parsed = parseModelJson(raw) as { questions?: unknown }
    const items = Array.isArray(parsed?.questions) ? parsed.questions : []
    const valid = items
      .map((q) => quizQuestionSchema.safeParse(q))
      .filter((r) => r.success)
      .map((r) => r.data as QuizQuestion)
    const questions = cleanQuiz(valid, allowed)
    if (questions.length < QUIZ_QUESTIONS) throw new Error('Quiz incomplet')
    await db.sql`UPDATE daily_quizzes SET status = 'ready', questions = ${JSON.stringify(questions)}::jsonb,
      updated_at = now() WHERE id = ${id}`
  } catch {
    await db.sql`UPDATE daily_quizzes SET status = 'failed', updated_at = now() WHERE id = ${id}`
  }
}

export async function generateLesson(id: string) {
  const db = getDatabase()
  const [lesson] = await db.sql<{ classe: string; serie: string; matiere: string; chapitre: string }>`UPDATE lessons
    SET status = 'generating', updated_at = now()
    WHERE id = ${id} AND status = 'pending' RETURNING classe, serie, matiere, chapitre`
  if (!lesson) return
  try {
    const raw = await ask(
      LESSON_WRITER_MODEL,
      lessonWriterPrompt(lesson.classe, lesson.serie, lesson.matiere, lesson.chapitre),
      'Rédige la leçon maintenant.',
      6000,
      'lecon-redaction',
    )
    const written = lessonWrittenSchema.parse(parseModelJson(raw))
    if (written.hors_programme) {
      await db.sql`UPDATE lessons SET status = 'failed', error = 'hors_programme', updated_at = now() WHERE id = ${id}`
      return
    }
    const content = toLessonContent(written)
    if (!content) throw new Error('Leçon incomplète')
    const { titre, ...stored } = content
    await db.sql`UPDATE lessons SET status = 'ready', titre = ${titre},
      content = ${JSON.stringify(stored)}::jsonb,
      error = NULL, updated_at = now() WHERE id = ${id}`
  } catch {
    await db.sql`UPDATE lessons SET status = 'failed', error = 'generation', updated_at = now() WHERE id = ${id}`
  }
}

/**
 * Quiz du jour d'une classe : le crée en attente s'il n'existe pas, relance une génération
 * échouée ou bloquée (3 essais max par jour), puis réveille la fonction d'arrière-plan.
 */
export async function ensureQuiz(day: string, classe: string, serie: string, origin: string) {
  const db = getDatabase()
  const [created] = await db.sql<{ id: string }>`INSERT INTO daily_quizzes (id, day, classe, serie)
    VALUES (${crypto.randomUUID()}, ${day}, ${classe}, ${serie})
    ON CONFLICT (day, classe, serie) DO NOTHING RETURNING id`
  if (created) {
    await wakeContent('quiz', created.id, origin)
    return
  }
  const [retry] = await db.sql<{ id: string }>`UPDATE daily_quizzes
    SET status = 'pending', attempts = attempts + 1, updated_at = now()
    WHERE day = ${day} AND classe = ${classe} AND serie = ${serie} AND attempts < 3
      AND ((status = 'failed' AND updated_at < now() - interval '1 minute')
        OR (status IN ('pending', 'generating') AND updated_at < now() - interval '12 minutes'))
    RETURNING id`
  if (retry) await wakeContent('quiz', retry.id, origin)
}

type LessonRow = {
  id: string
  classe: string
  serie: string
  matiere: string
  chapitre: string
  status: string
  titre: string | null
  content: unknown
  error: string | null
}

/** Leçon par identifiant, au format affiché par l'interface (null si introuvable). */
export async function findLesson(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null
  const [row] = await getDatabase().sql<LessonRow>`SELECT id, classe, serie, matiere, chapitre, status, titre, content, error
    FROM lessons WHERE id = ${id}`
  if (!row) return null
  const content = (typeof row.content === 'string' ? JSON.parse(row.content) : row.content) as
    | Omit<import('./lecons').LeconIA, 'id' | 'classe' | 'serie' | 'matiere' | 'chapitre' | 'titre'>
    | null
  return {
    id: row.id,
    classe: row.classe,
    serie: row.serie,
    matiere: row.matiere,
    chapitre: row.chapitre,
    status: row.status,
    error: row.error,
    lecon:
      row.status === 'ready' && content && row.titre
        ? ({
            id: row.id,
            classe: row.classe,
            serie: row.serie,
            matiere: row.matiere,
            chapitre: row.chapitre,
            titre: row.titre,
            etapes: content.etapes,
            reformulations: content.reformulations,
            objectifs: content.objectifs,
            amorce: content.amorce,
            verifications: content.verifications,
            pratique: content.pratique,
            motsCles: content.motsCles,
            formules: content.formules,
            exemples: content.exemples,
            retenir: content.retenir,
            test: content.test,
          } satisfies import('./lecons').LeconIA)
        : null,
  }
}

// ── Programme officiel et leçons rédigées à l'avance ─────────────────────────────

export async function generateProgramme(id: string) {
  const db = getDatabase()
  const [prog] = await db.sql<{ classe: string; serie: string; matiere: string }>`UPDATE lesson_programmes
    SET status = 'generating', updated_at = now()
    WHERE id = ${id} AND status = 'pending' RETURNING classe, serie, matiere`
  if (!prog) return
  try {
    const raw = await ask(
      LESSON_MODEL,
      programmePrompt(prog.classe, prog.serie, prog.matiere),
      'Donne la liste des chapitres maintenant.',
      2000,
      'programme',
    )
    const chapitres = cleanProgramme(programmeSchema.parse(parseModelJson(raw)).chapitres)
    if (chapitres.length < 4) throw new Error('Programme incomplet')
    await db.sql`UPDATE lesson_programmes SET status = 'ready', chapitres = ${JSON.stringify(chapitres)}::jsonb,
      updated_at = now() WHERE id = ${id}`
    // Les deux premiers chapitres de l'année sont rédigés tout de suite ; la suite chaque nuit.
    const origin = process.env.URL
    if (origin)
      for (const chapitre of chapitres.slice(0, 2)) {
        const [row] = await db.sql<{ id: string }>`INSERT INTO lessons (id, classe, serie, matiere, chapitre, chapitre_key, requested_by)
          VALUES (${crypto.randomUUID()}, ${prog.classe}, ${prog.serie}, ${prog.matiere}, ${chapitre}, ${chapitreKey(chapitre)}, ${PROGRAMME_REQUESTER})
          ON CONFLICT (classe, serie, matiere, chapitre_key) DO NOTHING RETURNING id`
        if (row) await generateLesson(row.id)
      }
  } catch {
    await db.sql`UPDATE lesson_programmes SET status = 'failed', updated_at = now() WHERE id = ${id}`
  }
}

export type Programme = { status: 'ready' | 'preparing' | 'failed'; chapitres: string[] }

/** Programme d'une matière : le lit, ou le fait établir (3 essais, relance si bloqué). */
export async function ensureProgramme(
  classe: string,
  serie: string,
  matiere: string,
  origin: string,
): Promise<Programme> {
  const db = getDatabase()
  const [row] = await db.sql<{ id: string; status: string; chapitres: unknown; attempts: number; stale: boolean }>`
    SELECT id, status, chapitres, attempts, updated_at < now() - interval '10 minutes' AS stale
    FROM lesson_programmes WHERE classe = ${classe} AND serie = ${serie} AND matiere = ${matiere}`
  if (row?.status === 'ready') {
    const list = typeof row.chapitres === 'string' ? JSON.parse(row.chapitres) : row.chapitres
    return { status: 'ready', chapitres: Array.isArray(list) ? list.map(String) : [] }
  }
  if (!row) {
    const [created] = await db.sql<{ id: string }>`INSERT INTO lesson_programmes (id, classe, serie, matiere)
      VALUES (${crypto.randomUUID()}, ${classe}, ${serie}, ${matiere})
      ON CONFLICT (classe, serie, matiere) DO NOTHING RETURNING id`
    if (created) await wakeContent('programme', created.id, origin)
    return { status: 'preparing', chapitres: [] }
  }
  const retry = Number(row.attempts) < 3 && (row.status === 'failed' || row.stale)
  if (retry) {
    const [again] = await db.sql<{ id: string }>`UPDATE lesson_programmes
      SET status = 'pending', attempts = attempts + 1, updated_at = now()
      WHERE id = ${row.id} AND status <> 'ready' RETURNING id`
    if (again) await wakeContent('programme', again.id, origin)
    return { status: 'preparing', chapitres: [] }
  }
  return { status: row.status === 'failed' ? 'failed' : 'preparing', chapitres: [] }
}

/** Classes (et séries) qui ont au moins un élève. */
export async function activeClasses() {
  const rows = await getDatabase().sql<{ classe: string; serie: string }>`SELECT DISTINCT classe, serie FROM profiles`
  const seen = new Map<string, { classe: string; serie: string }>()
  for (const r of rows) {
    const serie = normalizeSerie(r.classe, r.serie)
    if (cycleOf(r.classe) === 'lycee' && !SERIES_PAR_CLASSE[r.classe]?.includes(serie)) continue
    seen.set(`${r.classe}|${serie}`, { classe: r.classe, serie })
  }
  return [...seen.values()]
}

/**
 * Chaque nuit : établit les programmes manquants des classes qui ont des élèves, puis réserve
 * les leçons des chapitres suivants, dans l'ordre du programme et à tour de rôle entre les matières
 * (budget AUTO_LESSONS_PER_NIGHT, ou le réglage admin « lecons_auto_nuit »).
 */
export async function prepareProgrammeLessons(origin: string) {
  const db = getDatabase()
  const [setting] = await db.sql<{ value: string }>`SELECT value FROM app_settings WHERE key = 'lecons_auto_nuit'`
  const budget = Math.max(0, Math.min(300, Number(setting?.value ?? AUTO_LESSONS_PER_NIGHT) || 0))
  const queues: { classe: string; serie: string; matiere: string; todo: string[] }[] = []
  for (const { classe, serie } of await activeClasses())
    for (const m of matieresPour(classe, serie)) {
      const prog = await ensureProgramme(classe, serie, m.id, origin)
      if (prog.status !== 'ready') continue
      const existing = await db.sql<{ chapitre_key: string }>`SELECT chapitre_key FROM lessons
        WHERE classe = ${classe} AND serie = ${serie} AND matiere = ${m.id}`
      const known = new Set(existing.map((e) => e.chapitre_key))
      const todo = prog.chapitres.filter((c) => !known.has(chapitreKey(c)))
      if (todo.length) queues.push({ classe, serie, matiere: m.id, todo })
    }
  let left = budget
  while (left > 0 && queues.some((q) => q.todo.length)) {
    for (const q of queues) {
      const chapitre = q.todo.shift()
      if (!chapitre || left <= 0) continue
      const id = crypto.randomUUID()
      const [row] = await db.sql<{ id: string }>`INSERT INTO lessons (id, classe, serie, matiere, chapitre, chapitre_key, requested_by)
        VALUES (${id}, ${q.classe}, ${q.serie}, ${q.matiere}, ${chapitre}, ${chapitreKey(chapitre)}, ${PROGRAMME_REQUESTER})
        ON CONFLICT (classe, serie, matiere, chapitre_key) DO NOTHING RETURNING id`
      if (!row) continue
      left--
      if (!(await wakeContent('lecon', id, origin)))
        await db.sql`UPDATE lessons SET status = 'failed', error = 'generation', updated_at = now() WHERE id = ${id}`
    }
  }
  return { reservees: budget - left }
}

// ── « Explique-moi cette leçon » ─────────────────────────────────────────────────

export async function generateExplanation(id: string) {
  const db = getDatabase()
  const [row] = await db.sql<{ lesson_id: string; niveau: string }>`UPDATE lesson_explanations
    SET status = 'generating', updated_at = now()
    WHERE id = ${id} AND status = 'pending' RETURNING lesson_id, niveau`
  if (!row) return
  try {
    const { explicationPrompt, explicationSchema, maxTokensFor, modelFor, NIVEAUX_EXPLICATION } = await import(
      './explication'
    )
    const niveau = NIVEAUX_EXPLICATION.find((n) => n === row.niveau)
    const lecon = (await findLesson(row.lesson_id))?.lecon
    if (!niveau || !lecon) throw new Error('Leçon introuvable')
    const raw = await ask(
      modelFor(niveau, { sonnet: LESSON_MODEL, opus: LESSON_WRITER_MODEL }),
      explicationPrompt(lecon, niveau),
      'Explique-moi cette leçon maintenant.',
      maxTokensFor(niveau),
      `explication-${niveau}`,
    )
    const content = explicationSchema.parse(parseModelJson(raw))
    await db.sql`UPDATE lesson_explanations SET status = 'ready', content = ${JSON.stringify(content)}::jsonb,
      updated_at = now() WHERE id = ${id}`
  } catch {
    await db.sql`UPDATE lesson_explanations SET status = 'failed', updated_at = now() WHERE id = ${id}`
  }
}

// ── Rédaction express d'une leçon (en direct) ────────────────────────────────────

export class HorsProgrammeError extends Error {}

/**
 * Rédige la leçon réservée `id` (statut « pending ») en direct : 5 parties en parallèle avec le modèle
 * rapide, `onUpdate` reçoit la leçon partielle à chaque partie terminée. Renvoie :
 * « ready » (leçon enregistrée), « hors_programme », « busy » (déjà en rédaction ailleurs)
 * ou « fallback » (échec : la rédaction complète repart en arrière-plan).
 */
export async function writeLessonLive(
  id: string,
  scope: { classe: string; serie: string },
  origin: string,
  onUpdate: (lecon: LeconIA & { complet: boolean }) => void,
) {
  const db = getDatabase()
  const [row] = await db.sql<{ classe: string; serie: string; matiere: string; chapitre: string }>`UPDATE lessons
    SET status = 'generating', updated_at = now()
    WHERE id = ${id} AND status = 'pending' AND classe = ${scope.classe} AND serie = ${scope.serie}
    RETURNING classe, serie, matiere, chapitre`
  if (!row) return 'busy' as const
  const parts: LiveParts = {}
  let horsProgramme = false
  const publish = () => {
    const lecon = assembleLiveLesson(parts)
    if (!lecon || horsProgramme) return
    try {
      onUpdate({ id, classe: row.classe, serie: row.serie, matiere: row.matiere, chapitre: row.chapitre, ...lecon })
    } catch {
      // Navigateur parti : la rédaction continue et sera enregistrée pour la classe.
    }
  }
  const run = async <K extends LivePart>(part: K, memo?: string[]) => {
    for (let essai = 0; ; essai++) {
      try {
        const raw = await ask(
          LESSON_FAST_MODEL,
          livePartPrompt(part, row, memo),
          'Rédige cette partie maintenant.',
          LIVE_MAX_TOKENS[part],
          `lecon-direct-${part}`,
          35_000,
        )
        const data = livePartSchemas[part].parse(parseModelJson(raw)) as LiveParts[K]
        if (part === 'ouverture') {
          const o = data as LiveParts['ouverture']
          if (o?.hors_programme) throw new HorsProgrammeError()
          if (!o?.titre || !o.intuition || !o.reformulation) throw new Error('Ouverture incomplète')
        }
        if (part === 'test' && !cleanTest((data as LiveParts['test'])?.questions)) throw new Error('Test incomplet')
        parts[part] = data
        publish()
        return data
      } catch (error) {
        if (error instanceof HorsProgrammeError || essai >= 1 || horsProgramme) throw error
      }
    }
  }
  try {
    const ouverture = run('ouverture').catch((e) => {
      if (e instanceof HorsProgrammeError) horsProgramme = true
      throw e
    })
    const suite = run('memo').then((m) =>
      Promise.all([
        run('exemple', m?.memo),
        // Exemples supplémentaires : un échec n'empêche pas la leçon d'être complète.
        run('exemples', m?.memo).catch(() => undefined),
        run('pieges', m?.memo),
        run('test', m?.memo),
      ]),
    )
    await Promise.all([ouverture, suite])
    const lecon = assembleLiveLesson(parts)
    if (!lecon?.complet) throw new Error('Leçon incomplète')
    const { titre, ...rest } = lecon
    const stored: Partial<typeof rest> = { ...rest }
    delete stored.complet
    await db.sql`UPDATE lessons SET status = 'ready', titre = ${titre}, content = ${JSON.stringify(stored)}::jsonb,
      error = NULL, updated_at = now() WHERE id = ${id}`
    return 'ready' as const
  } catch {
    if (horsProgramme) {
      await db.sql`UPDATE lessons SET status = 'failed', error = 'hors_programme', updated_at = now() WHERE id = ${id}`
      return 'hors_programme' as const
    }
    // Repli : le Professeur IA rédige la leçon complète en arrière-plan.
    await db.sql`UPDATE lessons SET status = 'pending', updated_at = now() WHERE id = ${id} AND status = 'generating'`
    if (!(await wakeContent('lecon', id, origin)))
      await db.sql`UPDATE lessons SET status = 'failed', error = 'generation', updated_at = now() WHERE id = ${id}`
    return 'fallback' as const
  }
}

/** Test de fin de leçon d'une leçon plus ancienne : rédigé une fois (modèle rapide) puis partagé. */
export async function ensureLessonTest(lecon: LeconIA) {
  if (lecon.test?.length) return lecon.test
  const raw = await ask(
    LESSON_FAST_MODEL,
    lessonTestPrompt(lecon),
    'Rédige le test maintenant.',
    LIVE_MAX_TOKENS.test,
    'lecon-test',
    40_000,
  )
  const test = cleanTest(lessonTestSchema.parse(parseModelJson(raw)).questions)
  if (!test) throw new Error('Test incomplet')
  await getDatabase().sql`UPDATE lessons SET content = jsonb_set(content, '{test}', ${JSON.stringify(test)}::jsonb)
    WHERE id = ${lecon.id} AND content IS NOT NULL AND content->'test' IS NULL`
  return test
}
