import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { ADMIN_EMAIL, OFFERS } from './config'
import {
  cashPaymentSchema,
  onlinePaymentSchema,
  reviewPaymentSchema,
} from './billing'

export const getAdminAccess = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { billingUser, ensureAdminIdentity } =
      await import('./billing.server')
    const user = await billingUser()
    if (!user) return 'anonymous' as const
    if (await ensureAdminIdentity(user)) return 'allowed' as const
    // Adresse admin pas encore confirmée par e-mail : on explique comment finir.
    return user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
      ? ('setup' as const)
      : ('forbidden' as const)
  },
)

export const getBilling = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { billingUser, ensureAdminIdentity } =
      await import('./billing.server')
    const user = await billingUser()
    if (!user) return null
    const { getDatabase } = await import('@netlify/database')
    const db = getDatabase()
    const [subscription] =
      await db.sql`SELECT offer_id, expires_at::text, expires_at > now() AS active FROM subscriptions WHERE user_id = ${user.id}`
    const payments =
      await db.sql`SELECT id, offer_id, amount, method, reference, status, reason, created_at::text FROM payments WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT 30`
    return {
      userId: user.id,
      subscription: subscription
        ? {
            offerId: String(subscription.offer_id),
            expiresAt: new Date(String(subscription.expires_at)).toISOString(),
            active: !!subscription.active,
          }
        : null,
      payments: payments.map((p) => ({
        id: String(p.id),
        offerId: String(p.offer_id),
        amount: Number(p.amount),
        method: String(p.method),
        reference: String(p.reference),
        status: String(p.status),
        reason: p.reason ? String(p.reason) : null,
        createdAt: new Date(String(p.created_at)).toISOString(),
      })),
      isAdmin: await ensureAdminIdentity(user),
      access: await (await import('./access.server')).studentAccess(user.id),
      announcement: await (
        await import('./admin.server')
      ).currentAnnouncement(),
    }
  },
)

export const submitPayment = createServerFn({ method: 'POST' })
  .validator(onlinePaymentSchema)
  .handler(async ({ data }) => {
    const { requireBillingUser, billingTransaction, auditPayment } =
      await import('./billing.server')
    const user = await requireBillingUser()
    const offer = OFFERS.find((o) => o.id === data.offerId)!
    // Contrôles rapides avant d'analyser l'image (évite de lire un reçu déjà voué au refus).
    const { refusImmediat } = await import('./sentinel')
    const { sameReferenceStatuses } = await import('./sentinel.server')
    const early = refusImmediat({
      reference: data.reference,
      sameReference: await sameReferenceStatuses(data.reference),
    })
    if (early) throw new Error(early)
    const { receiptChecksLastHour, readReceipt, saveReceipt } =
      await import('./recu.server')
    if ((await receiptChecksLastHour(user.id)) >= 6)
      throw new Error(
        'Tu as envoyé beaucoup de reçus en une heure. Réessaie plus tard ou contacte le service client.',
      )
    const { decideReceipt } = await import('./recu')
    const decision = decideReceipt(
      await readReceipt(user.id, data.receipt, {
        amount: offer.price,
        method: data.method,
        reference: data.reference,
      }),
      { amount: offer.price, reference: data.reference },
    )
    if (decision.type === 'refus') throw new Error(decision.message)
    const id = crypto.randomUUID()
    let receiptKey: string | null = null
    try {
      receiptKey = await saveReceipt(id, data.receipt)
    } catch {
      decision.check.alertes.push(
        'La capture n’a pas pu être enregistrée : demande-la sur WhatsApp.',
      )
    }
    return billingTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        user.id,
      ])
      const profile = await client.query(
        'SELECT user_id FROM profiles WHERE user_id = $1',
        [user.id],
      )
      if (!profile.rows.length)
        throw new Error('Complète ton profil avant de déclarer un paiement.')
      const counts = await client.query(
        `SELECT count(*) FILTER (WHERE created_at > now() - interval '1 hour')::int AS recent,
      count(*) FILTER (WHERE status = 'rejected' AND reviewed_at > now() - interval '24 hours')::int AS rejected FROM payments WHERE user_id = $1`,
        [user.id],
      )
      if (counts.rows[0].rejected >= 3)
        throw new Error(
          'Déclarations temporairement suspendues après trois refus. Contacte le service client et réessaie après 24 h.',
        )
      if (counts.rows[0].recent >= 5)
        throw new Error(
          'Tu peux déclarer au maximum cinq paiements par heure. Réessaie plus tard.',
        )
      // Sentinelle : refus immédiat d'un rejeu (même ID, autre écriture) ou d'un ID inventé.
      const { normalizeReference } = await import('./sentinel')
      const same = await client.query(
        `SELECT status FROM payments WHERE regexp_replace(upper(reference), '[^A-Z0-9]', '', 'g') = $1`,
        [normalizeReference(data.reference)],
      )
      const refus = refusImmediat({
        reference: data.reference,
        sameReference: same.rows.map((r: { status: unknown }) => String(r.status)),
      })
      if (refus) throw new Error(refus)
      await client.query(
        `INSERT INTO payments (id, user_id, email, offer_id, amount, days, method, reference, receipt_key, receipt_check)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
        [
          id,
          user.id,
          user.email,
          offer.id,
          offer.price,
          offer.days,
          data.method,
          data.reference,
          receiptKey,
          JSON.stringify(decision.check),
        ],
      )
      await auditPayment(client, id, user.id, 'submitted')
      return {
        id,
        nomOk: decision.check.nomOk,
        alertes: decision.check.alertes.length,
      }
    })
  })

export const getAdminDashboard = createServerFn({ method: 'GET' })
  .validator(z.object({ page: z.number().int().min(0).max(100000).default(0) }))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import('./billing.server')
    await requireAdmin()
    const { getDatabase } = await import('@netlify/database')
    const db = getDatabase()
    const [counts] =
      await db.sql`SELECT count(*) FILTER (WHERE status = 'pending')::int AS pending, count(*) FILTER (WHERE status = 'accepted')::int AS accepted, COALESCE(sum(amount) FILTER (WHERE status = 'accepted'), 0)::text AS total FROM payments`
    const [students] = await db.sql`SELECT count(*)::int AS total FROM profiles`
    const payments =
      await db.sql`SELECT p.id, p.user_id, p.email, p.offer_id, p.amount, p.days, p.method, p.reference, p.status, p.reason, p.created_at::text, p.reviewed_at::text, p.receipt_key, p.receipt_check, f.first_name, f.classe, f.serie FROM payments p JOIN profiles f ON f.user_id = p.user_id ORDER BY p.created_at DESC, p.id LIMIT 31 OFFSET ${data.page * 30}`
    const audit =
      await db.sql`SELECT payment_id, action, reason, created_at::text FROM payment_audit ORDER BY created_at DESC LIMIT 20`
    const { sentinelVerdicts } = await import('./sentinel.server')
    const verdicts = await sentinelVerdicts(
      payments
        .slice(0, 30)
        .filter((p) => p.status === 'pending')
        .map((p) => String(p.id)),
    ).catch(() => ({}) as Awaited<ReturnType<typeof sentinelVerdicts>>)
    return {
      counts: {
        pending: Number(counts.pending),
        accepted: Number(counts.accepted),
        total: Number(counts.total),
        students: Number(students.total),
      },
      hasNext: payments.length > 30,
      payments: payments.slice(0, 30).map((p) => ({
        id: String(p.id),
        userId: String(p.user_id),
        email: p.email ? String(p.email) : null,
        offerId: String(p.offer_id),
        amount: Number(p.amount),
        method: String(p.method),
        reference: String(p.reference),
        status: String(p.status),
        reason: p.reason ? String(p.reason) : null,
        createdAt: new Date(String(p.created_at)).toISOString(),
        firstName: String(p.first_name),
        classe: String(p.classe),
        serie: String(p.serie),
        sentinelle: verdicts[String(p.id)] ?? null,
        recu: p.receipt_key ? true : false,
        controleRecu: parseCheck(p.receipt_check),
      })),
      audit: audit.map((a) => ({
        paymentId: String(a.payment_id),
        action: String(a.action),
        reason: a.reason ? String(a.reason) : null,
        createdAt: new Date(String(a.created_at)).toISOString(),
      })),
    }
  })

export const findStudents = createServerFn({ method: 'GET' })
  .validator(z.object({ query: z.string().trim().min(2).max(100) }))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import('./billing.server')
    await requireAdmin()
    const { getDatabase } = await import('@netlify/database')
    const db = getDatabase()
    const rows =
      await db.sql`SELECT f.user_id, f.first_name, f.classe, f.serie, s.expires_at::text FROM profiles f LEFT JOIN subscriptions s ON s.user_id = f.user_id WHERE strpos(lower(f.first_name), lower(${data.query})) > 0 OR f.user_id = ${data.query} ORDER BY f.first_name, f.user_id LIMIT 20`
    return rows.map((r) => ({
      userId: String(r.user_id),
      firstName: String(r.first_name),
      classe: String(r.classe),
      serie: String(r.serie),
      expiresAt: r.expires_at
        ? new Date(String(r.expires_at)).toISOString()
        : null,
    }))
  })

export const reviewPayment = createServerFn({ method: 'POST' })
  .validator(reviewPaymentSchema)
  .handler(async ({ data }) => {
    const {
      requireAdmin,
      billingTransaction,
      activateSubscription,
      auditPayment,
    } = await import('./billing.server')
    const admin = await requireAdmin()
    return billingTransaction(async (client) => {
      // Lock student first, then payment: same lock order as cash registration.
      const target = await client.query(
        'SELECT user_id FROM payments WHERE id = $1',
        [data.id],
      )
      if (!target.rows.length) throw new Error('Paiement introuvable.')
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        target.rows[0].user_id,
      ])
      const {
        rows: [payment],
      } = await client.query(
        'SELECT * FROM payments WHERE id = $1 FOR UPDATE',
        [data.id],
      )
      if (payment.status !== 'pending')
        throw new Error('Ce paiement a déjà été traité. Actualise la liste.')
      const offer = OFFERS.find((o) => o.id === payment.offer_id)
      if (
        !offer ||
        payment.amount !== offer.price ||
        payment.days !== offer.days
      )
        throw new Error(
          'Les informations de ce paiement ne correspondent pas à une offre valide.',
        )
      if (data.decision === 'accepted') {
        // Sentinelle : un même ID de transaction ne peut débloquer qu'un seul abonnement.
        const replay = await client.query(
          `SELECT 1 FROM payments WHERE id <> $1 AND status = 'accepted'
            AND regexp_replace(upper(reference), '[^A-Z0-9]', '', 'g') = regexp_replace(upper($2), '[^A-Z0-9]', '', 'g')`,
          [data.id, payment.reference],
        )
        if (replay.rows.length)
          throw new Error(
            'La Sentinelle bloque cette validation : cet ID de transaction a déjà débloqué un autre abonnement.',
          )
      }
      if (data.decision === 'accepted')
        await activateSubscription(
          client,
          payment.user_id,
          offer.id,
          offer.days,
        )
      await client.query(
        'UPDATE payments SET status = $2, reason = $3, reviewed_by = $4, reviewed_at = now() WHERE id = $1',
        [
          data.id,
          data.decision,
          data.decision === 'rejected' ? data.reason : null,
          admin.id,
        ],
      )
      await auditPayment(
        client,
        data.id,
        admin.id,
        data.decision,
        data.reason || null,
      )
      return { saved: true }
    })
  })

export const recordCashPayment = createServerFn({ method: 'POST' })
  .validator(cashPaymentSchema)
  .handler(async ({ data }) => {
    const {
      requireAdmin,
      billingTransaction,
      activateSubscription,
      auditPayment,
    } = await import('./billing.server')
    const admin = await requireAdmin()
    const offer = OFFERS.find((o) => o.id === data.offerId)!
    return billingTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        data.userId,
      ])
      const previous = await client.query(
        'SELECT id, user_id, offer_id, method FROM payments WHERE id = $1',
        [data.id],
      )
      if (previous.rows.length) {
        const p = previous.rows[0]
        if (
          p.user_id !== data.userId ||
          p.offer_id !== data.offerId ||
          p.method !== 'Espèces'
        )
          throw new Error('Référence déjà utilisée pour un autre paiement.')
        return { id: data.id }
      }
      const student = await client.query(
        'SELECT user_id FROM profiles WHERE user_id = $1',
        [data.userId],
      )
      if (!student.rows.length)
        throw new Error(
          'Élève introuvable. Il doit d’abord créer et compléter son compte.',
        )
      await client.query(
        `INSERT INTO payments (id, user_id, offer_id, amount, days, method, reference, status, reviewed_by, reviewed_at) VALUES ($1,$2,$3,$4,$5,'Espèces',$6,'accepted',$7,now())`,
        [
          data.id,
          data.userId,
          offer.id,
          offer.price,
          offer.days,
          'ESPECES-' + data.id,
          admin.id,
        ],
      )
      await activateSubscription(client, data.userId, offer.id, offer.days)
      await auditPayment(client, data.id, admin.id, 'cash_accepted')
      return { id: data.id }
    })
  })

function parseCheck(raw: unknown) {
  if (!raw) return null
  try {
    const c = (typeof raw === 'string' ? JSON.parse(raw) : raw) as import('./recu').ReceiptCheck
    return {
      nomOk: !!c.nomOk,
      beneficiaire: c.lecture?.beneficiaire ?? null,
      montant: c.lecture?.montant ?? null,
      reference: c.lecture?.reference ?? null,
      date: c.lecture?.date ?? null,
      alertes: Array.isArray(c.alertes) ? c.alertes.map(String) : [],
    }
  } catch {
    return null
  }
}

/** Console admin : capture du reçu d'un paiement (Blobs privé). */
export const getReceiptImage = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import('./billing.server')
    await requireAdmin()
    const { getDatabase } = await import('@netlify/database')
    const [row] = await getDatabase().sql<{ receipt_key: string | null }>`SELECT receipt_key FROM payments WHERE id = ${data.id}`
    if (!row?.receipt_key) return { image: null }
    const { loadReceipt } = await import('./recu.server')
    return { image: await loadReceipt(row.receipt_key) }
  })
