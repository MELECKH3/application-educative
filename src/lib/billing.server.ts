import { getDatabase } from '@netlify/database'
import { setResponseHeader } from '@tanstack/react-start/server'
import { ADMIN_EMAIL } from './config'
import { sessionUser } from './session.server'

type SessionUser = NonNullable<Awaited<ReturnType<typeof sessionUser>>>
const isAdminEmail = (email?: string | null) =>
  !!email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase()

/**
 * Accès admin automatique pour l'adresse autorisée (ADMIN_EMAIL) : dès que ce compte confirmé
 * se connecte, le rôle Identity `admin` lui est attribué s'il manque. Les rôles sont relus
 * auprès d'Identity (jamais depuis les métadonnées modifiables par l'utilisateur).
 */
export async function ensureAdminIdentity(user: SessionUser | null) {
  if (!user || !isAdminEmail(user.email)) return false
  if (user.roles?.includes('admin')) return true
  try {
    const { admin } = await import('@netlify/identity')
    const full = await admin.getUser(user.id)
    if (!full || !isAdminEmail(full.email) || !full.confirmedAt) return false
    const roles = Array.isArray(full.roles) ? full.roles : []
    if (!roles.includes('admin'))
      await admin.updateUser(user.id, {
        app_metadata: {
          ...(full.appMetadata ?? {}),
          roles: [...roles, 'admin'],
        },
      })
    return true
  } catch {
    return false
  }
}

export async function billingUser() {
  setResponseHeader('Cache-Control', 'private, no-store')
  return sessionUser()
}
export async function requireBillingUser() {
  const user = await billingUser()
  if (!user) throw new Error('Connecte-toi pour continuer.')
  return user
}
export async function requireAdmin() {
  const user = await requireBillingUser()
  if (!(await ensureAdminIdentity(user)))
    throw new Error('Accès réservé à l’administrateur autorisé.')
  // Mirror only the trusted Identity role; user metadata is never used.
  const db = getDatabase()
  await db.sql`INSERT INTO user_roles (user_id, role) VALUES (${user.id}, 'admin')
    ON CONFLICT (user_id) DO UPDATE SET role = 'admin', updated_at = now()`
  if (!(await hasRole(user, 'admin')))
    throw new Error('Droits administrateur indisponibles.')
  return user
}

export async function hasRole(
  user: Awaited<ReturnType<typeof requireBillingUser>>,
  role: 'admin',
) {
  if (!(await ensureAdminIdentity(user))) return false
  const db = getDatabase()
  const [row] =
    await db.sql`SELECT role FROM user_roles WHERE user_id = ${user.id} AND role = ${role}`
  return !!row
}

export async function billingTransaction<T>(
  fn: (
    client: Awaited<
      ReturnType<ReturnType<typeof getDatabase>['pool']['connect']>
    >,
  ) => Promise<T>,
) {
  const client = await getDatabase().pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === '23505'
    ) {
      // eslint-disable-next-line preserve-caught-error -- Do not expose database diagnostics to clients.
      throw new Error(
        'Cet ID de transaction a déjà été déclaré. Vérifie tes paiements.',
      )
    }
    if (error && typeof error === 'object' && 'code' in error)
      // eslint-disable-next-line preserve-caught-error -- Do not expose database diagnostics to clients.
      throw new Error(
        'Enregistrement indisponible. Réessaie dans quelques instants.',
      )
    throw error
  } finally {
    client.release()
  }
}
export type BillingClient = Parameters<
  Parameters<typeof billingTransaction>[0]
>[0]

export async function activateSubscription(
  client: BillingClient,
  userId: string,
  offerId: string,
  days: number,
) {
  // Caller holds the per-student transaction lock. The database clock decides dates.
  await client.query(
    `INSERT INTO subscriptions (user_id, offer_id, expires_at)
    VALUES ($1, $2, now() + $3 * interval '1 day')
    ON CONFLICT (user_id) DO UPDATE SET offer_id = EXCLUDED.offer_id,
      expires_at = GREATEST(subscriptions.expires_at, now()) + $3 * interval '1 day', updated_at = now()`,
    [userId, offerId, days],
  )
}
export async function auditPayment(
  client: BillingClient,
  paymentId: string,
  actorId: string,
  action: string,
  reason: string | null = null,
) {
  await client.query(
    'INSERT INTO payment_audit (id, payment_id, actor_id, action, reason) VALUES ($1, $2, $3, $4, $5)',
    [crypto.randomUUID(), paymentId, actorId, action, reason],
  )
}
