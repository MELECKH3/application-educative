import { createServerFn } from '@tanstack/react-start'
import {
  lessonRephraseRequestSchema,
  lessonSummaryRequestSchema,
  oralRequestSchema,
  reportRequestSchema,
  tutorRequestSchema,
} from './ai'

/** Tuteur socratique : 7 modes, contexte élève + sujet, photo de copie facultative. */
export const askTutor = createServerFn({ method: 'POST' })
  .validator(tutorRequestSchema)
  .handler(async ({ data }) => {
    const { requireAiStudent, runModel } = await import('./ai.server')
    const { tutorSystemPrompt, toModelMessages } = await import('./ai')
    const { findSujet } = await import('./sujets.server')
    const { matiereById } = await import('./curriculum')
    const { user, student, access } = await requireAiStudent()
    const { limitesFor } = await import('./access')
    const found = data.sujetId ? await findSujet(data.sujetId) : null
    // Sujet d'un niveau Premium : le tuteur ne le reçoit pas au forfait gratuit.
    const sujet =
      (found && limitesFor(access).niveaux.includes(found.niveau)
        ? found
        : null) ?? undefined
    const messages = toModelMessages(data.messages.slice(-20))
    if (messages.length === 0 || messages[messages.length - 1].role !== 'user')
      throw new Error('Écris ta question avant d’envoyer.')
    const content: Parameters<typeof runModel>[0]['messages'] = messages.map(
      (m) => ({
        role: m.role,
        content: m.content,
      }),
    )
    if (data.image) {
      const last = content[content.length - 1]
      last.content = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: data.image.mediaType,
            data: data.image.data,
          },
        },
        { type: 'text', text: String(last.content) },
      ]
    }
    const reply = await runModel({
      userId: user.id,
      kind: 'tuteur',
      mode: data.mode,
      system: tutorSystemPrompt(
        student,
        data.mode,
        sujet && {
          ...sujet,
          matiere: matiereById(sujet.matiere)?.nom ?? sujet.matiere,
        },
      ),
      messages: content,
      maxTokens: data.mode === 'Résumé de cours' ? 1200 : 800,
    })
    return { reply }
  })

/** Examinateur d'oral (mode écrit/vocal) puis évaluation /20 sur 5 critères. */
export const oralTurn = createServerFn({ method: 'POST' })
  .validator(oralRequestSchema)
  .handler(async ({ data }) => {
    const { requireAiStudent, runModel, AiUserError } =
      await import('./ai.server')
    const {
      oralSystemPrompt,
      oralEvaluationPrompt,
      oralTurnSchema,
      oralEvaluationSchema,
      parseModelJson,
      toModelMessages,
    } = await import('./ai')
    const { user, student, access } = await requireAiStudent()
    const { isPremium, PREMIUM_ONLY_MESSAGE } = await import('./access')
    if (!isPremium(access))
      throw new AiUserError(
        `L’oral avec l’examinateur IA fait partie de Premium. ${PREMIUM_ONLY_MESSAGE}`,
      )
    const { switchOn } = await import('./admin.server')
    if (await switchOn('coupure_oral'))
      throw new AiUserError(
        'L’oral est momentanément en pause. Réessaie un peu plus tard.',
      )
    if (data.finish) {
      const transcript = data.messages
        .map(
          (m) => `${m.role === 'eleve' ? 'ÉLÈVE' : 'EXAMINATEUR'} : ${m.text}`,
        )
        .join('\n')
      if (!data.messages.some((m) => m.role === 'eleve' && m.text.trim()))
        throw new AiUserError(
          'Réponds au moins une fois à l’examinateur avant de demander ta note.',
        )
      const raw = await runModel({
        userId: user.id,
        kind: 'oral',
        mode: 'evaluation',
        system: oralEvaluationPrompt(data, student),
        messages: [
          {
            role: 'user',
            content: `<conversation_donnees>\n${transcript}\n</conversation_donnees>`,
          },
        ],
        maxTokens: 2200,
      })
      try {
        const evaluation = oralEvaluationSchema.parse(parseModelJson(raw))
        const total = evaluation.criteres.reduce((s, c) => s + c.note, 0)
        return {
          type: 'evaluation' as const,
          evaluation: { ...evaluation, note: Math.round(total * 2) / 2 },
        }
      } catch (error) {
        throw new AiUserError('La note n’a pas pu être calculée. Réessaie.', {
          cause: error,
        })
      }
    }
    const messages = toModelMessages(data.messages)
    if (messages.length === 0 || messages[messages.length - 1].role !== 'user')
      messages.push({
        role: 'user',
        content: '(L’élève est prêt. Commence l’oral.)',
      })
    const raw = await runModel({
      userId: user.id,
      kind: 'oral',
      mode: data.lang,
      system: oralSystemPrompt(data, student),
      messages,
      maxTokens: 800,
    })
    try {
      return {
        type: 'turn' as const,
        turn: oralTurnSchema.parse(parseModelJson(raw)),
      }
    } catch {
      // Le modèle a répondu sans JSON : on garde sa réplique telle quelle.
      return {
        type: 'turn' as const,
        turn: { say: raw.slice(0, 1500), traduction: '', correction: null, aide: [] as string[] },
      }
    }
  })

/** Professeur IA : note du résumé /10, oublis, 3 à 5 questions de rappel, puis prochain rappel (J+1/J+3/J+7). */
export const gradeLessonSummary = createServerFn({ method: 'POST' })
  .validator(lessonSummaryRequestSchema)
  .handler(async ({ data }) => {
    const { requireAiStudent, runModel, AiUserError } =
      await import('./ai.server')
    const { lessonSummaryPrompt, lessonSummaryResultSchema, parseModelJson } =
      await import('./ai')
    const { findLesson } = await import('./contenu.server')
    const { LESSON_MODEL } = await import('./models')
    const { nextReviewDays } = await import('./lecons')
    const lecon = (await findLesson(data.leconId))?.lecon
    if (!lecon) throw new AiUserError('Leçon introuvable.')
    const { user, student } = await requireAiStudent()
    const raw = await runModel({
      userId: user.id,
      kind: 'lecon',
      mode: 'resume',
      model: LESSON_MODEL,
      system: lessonSummaryPrompt(student, lecon),
      messages: [
        {
          role: 'user',
          content: `<resume_eleve>\n${data.resume}\n</resume_eleve>`,
        },
      ],
      maxTokens: 1200,
    })
    let result
    try {
      result = lessonSummaryResultSchema.parse(parseModelJson(raw))
    } catch (error) {
      throw new AiUserError('La correction n’a pas pu être lue. Réessaie.', {
        cause: error,
      })
    }
    const note = Math.round(result.note * 2) / 2
    // Répétition espacée : une bonne note fait avancer d'un palier, une note faible fait revoir demain.
    let rappelDans = 1
    try {
      const { getDatabase } = await import('@netlify/database')
      const db = getDatabase()
      const [prev] = await db.sql<{
        step: number
      }>`SELECT step FROM lesson_reviews
        WHERE user_id = ${user.id} AND lesson_id = ${lecon.id}`
      const step = note >= 6 ? (prev ? Number(prev.step) + 1 : 0) : 0
      rappelDans = note >= 6 ? nextReviewDays(step) : 1
      await db.sql`INSERT INTO lesson_reviews (user_id, lesson_id, step, last_note, last_at, next_at)
        VALUES (${user.id}, ${lecon.id}, ${step}, ${Math.round(note)}, now(), now() + make_interval(days => ${rappelDans}))
        ON CONFLICT (user_id, lesson_id) DO UPDATE SET step = EXCLUDED.step, last_note = EXCLUDED.last_note,
          last_at = now(), next_at = EXCLUDED.next_at`
    } catch {
      // Le rappel ne doit jamais empêcher l'élève de voir sa note.
    }
    return { ...result, note, rappelDans }
  })

/** Professeur IA : réexplique une partie de la leçon autrement. */
export const rephraseLessonStep = createServerFn({ method: 'POST' })
  .validator(lessonRephraseRequestSchema)
  .handler(async ({ data }) => {
    const { requireAiStudent, runModel, AiUserError } =
      await import('./ai.server')
    const { lessonRephrasePrompt } = await import('./ai')
    const { findLesson } = await import('./contenu.server')
    const { LESSON_MODEL } = await import('./models')
    const lecon = (await findLesson(data.leconId))?.lecon
    const step = lecon?.etapes.find((e) => e.key === data.etape)
    if (!lecon || !step) throw new AiUserError('Leçon introuvable.')
    const { user, student } = await requireAiStudent()
    const text = await runModel({
      userId: user.id,
      kind: 'lecon',
      mode: 'reformuler',
      model: LESSON_MODEL,
      system: lessonRephrasePrompt(student, lecon, step),
      messages: [
        {
          role: 'user',
          content: 'Réexplique-moi cette partie autrement, s’il te plaît.',
        },
      ],
      maxTokens: 700,
    })
    return { text }
  })

/** Signalement d'une réponse de l'IA, conservé pour la console admin. */
export const reportAiAnswer = createServerFn({ method: 'POST' })
  .validator(reportRequestSchema)
  .handler(async ({ data }) => {
    const { requireAiStudent, saveAiReport } = await import('./ai.server')
    const { user } = await requireAiStudent()
    await saveAiReport(user.id, data.kind, data.question, data.answer)
    return { saved: true }
  })

/** Console admin : usage réel de l'IA aujourd'hui (UTC = Abidjan) et derniers signalements. */
export const getAiOverview = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { requireAdmin } = await import('./billing.server')
    await requireAdmin()
    const { getDatabase } = await import('@netlify/database')
    const db = getDatabase()
    const [today] = await db.sql`SELECT
      count(*) FILTER (WHERE status = 'ok')::int AS ok,
      count(*) FILTER (WHERE status = 'error')::int AS errors,
      count(DISTINCT user_id)::int AS students,
      COALESCE(sum(input_tokens), 0)::text AS input_tokens,
      COALESCE(sum(output_tokens), 0)::text AS output_tokens
    FROM ai_events WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`
    const reports =
      await db.sql`SELECT r.id, r.kind, r.question, r.answer, r.created_at::text, p.first_name
    FROM ai_reports r LEFT JOIN profiles p ON p.user_id = r.user_id
    ORDER BY r.created_at DESC LIMIT 20`
    return {
      today: {
        ok: Number(today?.ok ?? 0),
        errors: Number(today?.errors ?? 0),
        students: Number(today?.students ?? 0),
        inputTokens: Number(today?.input_tokens ?? 0),
        outputTokens: Number(today?.output_tokens ?? 0),
      },
      reports: reports.map((r) => ({
        id: String(r.id),
        kind: String(r.kind),
        question: r.question ? String(r.question) : null,
        answer: String(r.answer),
        createdAt: new Date(String(r.created_at)).toISOString(),
        firstName: r.first_name ? String(r.first_name) : null,
      })),
    }
  },
)
