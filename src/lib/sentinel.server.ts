import { getDatabase } from '@netlify/database'
import { OFFERS } from './config'
import { analysePayment, normalizeReference, type Verdict } from './sentinel'

type Row = {
  id: string
  user_id: string
  offer_id: string
  amount: number
  reference: string
  created_at: string
}

/** Verdict de la Sentinelle pour des paiements (faits relus en base au moment de la déclaration). */
export async function sentinelVerdicts(ids: string[]): Promise<Record<string, Verdict>> {
  if (!ids.length) return {}
  const db = getDatabase()
  const rows = await db.sql<
    Row & {
      same: string[] | null
      decl24: number
      refus30: number
      pending_others: number
      age_min: number
      premium_days: number
    }
  >`SELECT p.id, p.user_id, p.offer_id, p.amount, p.reference,
      (SELECT array_agg(o.status) FROM payments o WHERE o.id <> p.id
        AND regexp_replace(upper(o.reference), '[^A-Z0-9]', '', 'g') = regexp_replace(upper(p.reference), '[^A-Z0-9]', '', 'g')) AS same,
      (SELECT count(*)::int FROM payments o WHERE o.user_id = p.user_id
        AND o.created_at BETWEEN p.created_at - interval '24 hours' AND p.created_at) AS decl24,
      (SELECT count(*)::int FROM payments o WHERE o.user_id = p.user_id AND o.status = 'rejected'
        AND o.created_at > p.created_at - interval '30 days') AS refus30,
      (SELECT count(*)::int FROM payments o WHERE o.user_id = p.user_id AND o.id <> p.id AND o.status = 'pending') AS pending_others,
      COALESCE((SELECT (extract(epoch FROM p.created_at - f.created_at) / 60)::int FROM profiles f WHERE f.user_id = p.user_id), 99999) AS age_min,
      COALESCE((SELECT GREATEST(0, floor(extract(epoch FROM s.expires_at - p.created_at) / 86400))::int
        FROM subscriptions s WHERE s.user_id = p.user_id), 0) AS premium_days
    FROM payments p WHERE p.id = ANY(${ids})`
  const out: Record<string, Verdict> = {}
  for (const r of rows)
    out[r.id] = analysePayment({
      reference: r.reference,
      amount: Number(r.amount),
      expectedAmount: OFFERS.find((o) => o.id === r.offer_id)?.price ?? null,
      sameReference: (r.same ?? []).map(String),
      declarations24h: Number(r.decl24),
      refus30j: Number(r.refus30),
      autresEnAttente: Number(r.pending_others),
      ageCompteMinutes: Number(r.age_min),
      joursPremiumRestants: Number(r.premium_days),
    })
  return out
}

/** Statuts des paiements dont la référence normalisée est identique. */
export async function sameReferenceStatuses(reference: string) {
  const rows = await getDatabase().sql<{ status: string }>`SELECT status FROM payments
    WHERE regexp_replace(upper(reference), '[^A-Z0-9]', '', 'g') = ${normalizeReference(reference)}`
  return rows.map((r) => r.status)
}
