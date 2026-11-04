import { getDatabase } from '@netlify/database'
import {
  accessFrom,
  ACCESS_BLOCKED_MESSAGE,
  limitesFor,
  PREMIUM_ONLY_MESSAGE,
  isPremium,
  type Access,
} from './access'

/** Battement envoyé par le navigateur toutes les 30 s quand l'élève est actif. */
export const BEAT_SECONDS = 30

type Row = {
  created_ms: string
  expires_ms: string | null
  offer_id: string | null
  granted: number | null
  seconds: number | null
  now_ms: string
}

/** Accès de l'élève calculé avec l'horloge de la base (null si le profil n'existe pas). */
export async function studentAccess(userId: string): Promise<Access | null> {
  const [row] = await getDatabase().sql<Row>`SELECT
      (extract(epoch FROM p.created_at) * 1000)::bigint::text AS created_ms,
      (extract(epoch FROM s.expires_at) * 1000)::bigint::text AS expires_ms,
      s.offer_id,
      g.minutes AS granted,
      u.seconds,
      (extract(epoch FROM now()) * 1000)::bigint::text AS now_ms
    FROM profiles p
    LEFT JOIN subscriptions s ON s.user_id = p.user_id
    LEFT JOIN free_plan_grants g ON g.user_id = p.user_id AND (g.expires_at IS NULL OR g.expires_at > now())
    LEFT JOIN daily_usage u ON u.user_id = p.user_id AND u.day = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD')
    WHERE p.user_id = ${userId}`
  if (!row) return null
  return accessFrom(
    new Date(Number(row.created_ms)),
    row.expires_ms
      ? {
          expiresAt: new Date(Number(row.expires_ms)),
          offerId: String(row.offer_id ?? ''),
        }
      : null,
    new Date(Number(row.now_ms)),
    {
      minutesOffertes: row.granted == null ? null : Number(row.granted),
      secondesUtilisees: Number(row.seconds ?? 0),
    },
  )
}

/**
 * Compte 30 s d'utilisation pour un élève au forfait gratuit (au plus un battement toutes les 25 s,
 * pour qu'un onglet dupliqué ou un script ne puisse ni gonfler ni contourner le compteur).
 */
export async function recordBeat(userId: string) {
  const before = await studentAccess(userId)
  if (!before || before.status !== 'gratuit') return before
  await getDatabase().sql`INSERT INTO daily_usage (user_id, day, seconds, last_beat_at)
    VALUES (${userId}, to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD'), ${BEAT_SECONDS}, now())
    ON CONFLICT (user_id, day) DO UPDATE SET seconds = daily_usage.seconds + ${BEAT_SECONDS}, last_beat_at = now()
    WHERE daily_usage.last_beat_at < now() - interval '25 seconds'`
  return studentAccess(userId)
}

export class AccessBlockedError extends Error {
  constructor(message = ACCESS_BLOCKED_MESSAGE) {
    super(message)
  }
}

/** À appeler par chaque fonction serveur de l'espace élève : refuse tout quand le temps gratuit du jour est épuisé. */
export async function assertStudentAccess(userId: string) {
  const access = await studentAccess(userId)
  if (access?.status === 'bloque') throw new AccessBlockedError()
  return access
}

/** Fonction réservée à Premium (essai compris). */
export async function assertPremium(userId: string, message = PREMIUM_ONLY_MESSAGE) {
  const access = await assertStudentAccess(userId)
  if (!isPremium(access)) throw new AccessBlockedError(message)
  return access
}

export async function studentLimits(userId: string) {
  return limitesFor(await studentAccess(userId))
}
