import Anthropic from '@anthropic-ai/sdk'
import { getDatabase } from '@netlify/database'
import { setResponseHeader } from '@tanstack/react-start/server'
import {
  AI_MESSAGES_PER_DAY,
  AI_MESSAGES_PER_MINUTE,
  type StudentContext,
} from './ai'
import { sessionUser } from './session.server'

import { TUTOR_MODEL, generationParams } from './models'

// Modèle par défaut (tuteur, oral) ; le Professeur IA des leçons demande un modèle plus puissant.
export const AI_MODEL = TUTOR_MODEL

let client: Anthropic | null = null
function anthropic() {
  client ??= new Anthropic()
  return client
}

export class AiUserError extends Error {}

/** Élève connecté avec un profil complet : l'IA s'adapte à sa classe et à son pays. */
export async function requireAiStudent() {
  setResponseHeader('Cache-Control', 'private, no-store')
  const user = await sessionUser()
  if (!user)
    throw new AiUserError('Ta session a expiré. Reconnecte-toi pour continuer.')
  const { switchOn } = await import('./admin.server')
  if (await switchOn('coupure_ia'))
    throw new AiUserError(
      'L’IA est momentanément en pause. Réessaie un peu plus tard.',
    )
  const db = getDatabase()
  const [profile] = await db.sql<{
    first_name: string
    classe: string
    serie: string
    pays: string
    niveau_prefere: number
  }>`SELECT first_name, classe, serie, pays, niveau_prefere FROM profiles WHERE user_id = ${user.id}`
  if (!profile)
    throw new AiUserError('Termine ton profil élève pour utiliser l’IA.')
  const { studentAccess } = await import('./access.server')
  const { ACCESS_BLOCKED_MESSAGE } = await import('./access')
  const access = await studentAccess(user.id)
  if (access?.status === 'bloque') throw new AiUserError(ACCESS_BLOCKED_MESSAGE)
  const student: StudentContext = {
    firstName: profile.first_name,
    classe: profile.classe,
    serie: profile.serie,
    pays: profile.pays,
    niveauPrefere: profile.niveau_prefere,
  }
  return { user, student, access }
}

/** 20 messages par minute et un plafond quotidien, comptés en base (pas dans le navigateur). */
export async function checkAiQuota(userId: string) {
  const db = getDatabase()
  const [row] = await db.sql<{ minute: number; day: number }>`
    SELECT
      count(*) FILTER (WHERE created_at > now() - interval '1 minute')::int AS minute,
      count(*) FILTER (WHERE created_at > date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')::int AS day
    FROM ai_events
    WHERE user_id = ${userId} AND created_at > now() - interval '1 day' AND status <> 'blocked'
      AND kind NOT IN ('recu', 'explication-vue')`
  if ((row?.minute ?? 0) >= AI_MESSAGES_PER_MINUTE)
    throw new AiUserError(
      `Tu as envoyé ${AI_MESSAGES_PER_MINUTE} messages en une minute. Prends le temps de réfléchir, puis réessaie dans un instant.`,
    )
  // Forfait gratuit : quelques messages par jour ; Premium (essai compris) : plafond large.
  const { studentAccess } = await import('./access.server')
  const { isPremium, LIMITES } = await import('./access')
  const premium = isPremium(await studentAccess(userId))
  const limit = premium
    ? Math.min(AI_MESSAGES_PER_DAY, LIMITES.premium.messagesIaParJour)
    : LIMITES.gratuit.messagesIaParJour
  if ((row?.day ?? 0) >= limit)
    throw new AiUserError(
      premium
        ? 'Tu as atteint la limite de messages IA pour aujourd’hui. Elle revient à minuit (heure d’Abidjan).'
        : `Le forfait gratuit comprend ${limit} échanges avec l’IA par jour. Ils reviennent à minuit, ou passe Premium pour discuter sans compter.`,
    )
}

async function logAiEvent(
  userId: string,
  kind: string,
  mode: string | null,
  status: 'ok' | 'error' | 'blocked',
  usage?: { input_tokens?: number | null; output_tokens?: number | null },
) {
  try {
    const db = getDatabase()
    await db.sql`INSERT INTO ai_events (id, user_id, kind, mode, status, input_tokens, output_tokens)
      VALUES (${crypto.randomUUID()}, ${userId}, ${kind}, ${mode}, ${status},
        ${usage?.input_tokens ?? 0}, ${usage?.output_tokens ?? 0})`
  } catch {
    // Le journal ne doit jamais empêcher l'élève de recevoir sa réponse.
  }
}

type Content = Anthropic.MessageParam['content']

/** Appelle le modèle, journalise l'usage et renvoie un texte, ou une erreur lisible par l'élève. */
export async function runModel(opts: {
  userId: string
  kind: string
  mode?: string
  system: string
  messages: { role: 'user' | 'assistant'; content: Content }[]
  maxTokens: number
  model?: string
}) {
  await checkAiQuota(opts.userId)
  try {
    const message = await anthropic().messages.create({
      model: opts.model ?? AI_MODEL,
      ...generationParams(opts.model ?? AI_MODEL, opts.maxTokens),
      system: opts.system,
      messages: opts.messages,
    })
    const text = message.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim()
    await logAiEvent(
      opts.userId,
      opts.kind,
      opts.mode ?? null,
      text ? 'ok' : 'error',
      message.usage,
    )
    if (!text)
      throw new AiUserError('L’IA n’a pas pu répondre. Reformule ta demande.')
    return text
  } catch (error) {
    if (error instanceof AiUserError) throw error
    await logAiEvent(opts.userId, opts.kind, opts.mode ?? null, 'error')
    const status =
      error && typeof error === 'object' && 'status' in error
        ? Number((error as { status?: unknown }).status)
        : 0
    if (status === 429)
      throw new AiUserError(
        'L’IA est très demandée en ce moment. Réessaie dans une minute.',
        { cause: error },
      )
    throw new AiUserError(
      'L’IA est momentanément indisponible. Réessaie dans quelques instants.',
      { cause: error },
    )
  }
}

export async function saveAiReport(
  userId: string,
  kind: string,
  question: string | undefined,
  answer: string,
) {
  const db = getDatabase()
  await db.sql`INSERT INTO ai_reports (id, user_id, kind, question, answer)
    VALUES (${crypto.randomUUID()}, ${userId}, ${kind}, ${question ?? null}, ${answer})`
}
