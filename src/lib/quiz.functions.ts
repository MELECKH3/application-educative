import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { quizSubmitSchema, type QuizQuestion } from './quiz'

async function quizStudent() {
  const { setResponseHeader, getRequestUrl } = await import('@tanstack/react-start/server')
  setResponseHeader('Cache-Control', 'private, no-store')
  const { sessionUser } = await import('./session.server')
  const user = await sessionUser()
  if (!user) throw new Error('Ta session a expiré. Reconnecte-toi pour continuer.')
  const { getDatabase } = await import('@netlify/database')
  const [profile] = await getDatabase().sql<{ classe: string; serie: string }>`SELECT classe, serie FROM profiles WHERE user_id = ${user.id}`
  if (!profile) throw new Error('Termine ton profil élève pour jouer au quiz.')
  const { assertStudentAccess } = await import('./access.server')
  await assertStudentAccess(user.id)
  const { normalizeSerie } = await import('./curriculum')
  return {
    user,
    classe: profile.classe,
    serie: normalizeSerie(profile.classe, profile.serie),
    origin: getRequestUrl().origin,
  }
}

const asQuestions = (v: unknown): QuizQuestion[] =>
  (typeof v === 'string' ? JSON.parse(v) : v) as QuizQuestion[]
const asAnswers = (v: unknown): number[] => (typeof v === 'string' ? JSON.parse(v) : v) as number[]

async function streakOf(userId: string, today: string) {
  const { getDatabase } = await import('@netlify/database')
  const { quizStreak } = await import('./quiz')
  const rows = await getDatabase().sql<{ day: string }>`SELECT DISTINCT day FROM quiz_attempts
    WHERE user_id = ${userId} AND finished_at IS NOT NULL ORDER BY day DESC LIMIT 400`
  return quizStreak(rows.map((r) => r.day), today)
}

function corrections(questions: QuizQuestion[], answers: number[]) {
  return questions.map((q, i) => ({
    matiere: q.matiere,
    question: q.question,
    choix: q.choix,
    bonne: q.bonne,
    explication: q.explication,
    reponse: answers[i] ?? -1,
  }))
}

/** État du quiz du jour de l'élève (sans les questions tant qu'il n'a pas commencé). */
export const getDailyQuiz = createServerFn({ method: 'GET' }).handler(async () => {
  const { user, classe, serie, origin } = await quizStudent()
  const { getDatabase } = await import('@netlify/database')
  const { quizDay, QUIZ_QUESTIONS, QUIZ_SECONDS_PER_QUESTION } = await import('./quiz')
  const { ensureQuiz } = await import('./contenu.server')
  const day = quizDay()
  const db = getDatabase()
  const find = () => db.sql<{ id: string; status: string; questions: unknown; attempts: number }>`SELECT id, status, questions, attempts
    FROM daily_quizzes WHERE day = ${day} AND classe = ${classe} AND serie = ${serie}`
  let [quiz] = await find()
  if (!quiz || quiz.status !== 'ready') {
    try {
      await ensureQuiz(day, classe, serie, origin)
    } catch {
      // Le quiz reste « en préparation » ; l'élève réessaiera.
    }
    ;[quiz] = await find()
  }
  const streak = await streakOf(user.id, day)
  const base = { day, classe, serie, streak, total: QUIZ_QUESTIONS, secondsPerQuestion: QUIZ_SECONDS_PER_QUESTION }
  if (!quiz || quiz.status !== 'ready')
    return {
      ...base,
      status: quiz?.status === 'failed' && Number(quiz.attempts) >= 3 ? ('unavailable' as const) : ('preparing' as const),
    }
  const [attempt] = await db.sql<{ answers: unknown; score: number | null; finished_at: string | null }>`SELECT answers, score, finished_at::text
    FROM quiz_attempts WHERE user_id = ${user.id} AND quiz_id = ${quiz.id}`
  if (attempt?.finished_at) {
    const questions = asQuestions(quiz.questions)
    return {
      ...base,
      status: 'done' as const,
      quizId: quiz.id,
      score: Number(attempt.score ?? 0),
      corrections: corrections(questions, asAnswers(attempt.answers)),
    }
  }
  return { ...base, status: attempt ? ('started' as const) : ('ready' as const), quizId: quiz.id }
})

/** Démarre (ou reprend) la tentative unique du jour : renvoie les questions sans les réponses. */
export const startDailyQuiz = createServerFn({ method: 'POST' })
  .validator(z.object({ quizId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { user, classe, serie } = await quizStudent()
    const { getDatabase } = await import('@netlify/database')
    const { quizDay } = await import('./quiz')
    const db = getDatabase()
    const [quiz] = await db.sql<{ id: string; day: string; questions: unknown }>`SELECT id, day, questions FROM daily_quizzes
      WHERE id = ${data.quizId} AND day = ${quizDay()} AND classe = ${classe} AND serie = ${serie} AND status = 'ready'`
    if (!quiz) throw new Error('Ce quiz n’est plus disponible. Recharge la page.')
    const questions = asQuestions(quiz.questions)
    await db.sql`INSERT INTO quiz_attempts (id, user_id, quiz_id, day, total)
      VALUES (${crypto.randomUUID()}, ${user.id}, ${quiz.id}, ${quiz.day}, ${questions.length})
      ON CONFLICT (user_id, quiz_id) DO NOTHING`
    const [attempt] = await db.sql<{ finished_at: string | null }>`SELECT finished_at::text FROM quiz_attempts
      WHERE user_id = ${user.id} AND quiz_id = ${quiz.id}`
    if (attempt?.finished_at) throw new Error('Tu as déjà fait le quiz du jour. Reviens demain !')
    return {
      questions: questions.map((q) => ({ matiere: q.matiere, question: q.question, choix: q.choix })),
    }
  })

/** Rend la tentative : le score est calculé ici, une seule fois. */
export const submitDailyQuiz = createServerFn({ method: 'POST' })
  .validator(quizSubmitSchema)
  .handler(async ({ data }) => {
    const { user } = await quizStudent()
    const { getDatabase } = await import('@netlify/database')
    const { scoreQuiz, quizDay } = await import('./quiz')
    const db = getDatabase()
    const [quiz] = await db.sql<{ questions: unknown }>`SELECT questions FROM daily_quizzes WHERE id = ${data.quizId} AND status = 'ready'`
    if (!quiz) throw new Error('Ce quiz n’est plus disponible.')
    const questions = asQuestions(quiz.questions)
    const score = scoreQuiz(questions, data.answers)
    const [saved] = await db.sql<{ score: number }>`UPDATE quiz_attempts
      SET answers = ${JSON.stringify(data.answers)}::jsonb, score = ${score}, finished_at = now()
      WHERE user_id = ${user.id} AND quiz_id = ${data.quizId} AND finished_at IS NULL
      RETURNING score`
    if (!saved) throw new Error('Ta réponse a déjà été enregistrée. Recharge la page pour voir ton résultat.')
    return {
      score,
      total: questions.length,
      streak: await streakOf(user.id, quizDay()),
      corrections: corrections(questions, data.answers),
    }
  })
