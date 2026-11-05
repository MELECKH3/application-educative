import { z } from 'zod'
import { ADMIN_EMAIL, OFFERS } from './config'
import { receiptImageSchema } from './recu'

export const offerIdSchema = z.enum(['mensuel', 'trimestriel'])
export const onlinePaymentSchema = z.object({
  offerId: offerIdSchema,
  method: z.enum(['Wave', 'Orange Money']),
  reference: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9.\-_]{6,40}$/, 'Indique un ID de transaction valide.')
    .transform((s) => s.toUpperCase()),
  // Capture du reçu, obligatoire : elle doit porter le nom du bénéficiaire (Adou Melchi / Adou Meleck / Adou Meleckh).
  receipt: receiptImageSchema,
})
export const reviewPaymentSchema = z
  .object({
    id: z.string().uuid(),
    decision: z.enum(['accepted', 'rejected']),
    verified: z.boolean(),
    reason: z.string().trim().max(500),
  })
  .superRefine((v, ctx) => {
    if (v.decision === 'accepted' && !v.verified)
      ctx.addIssue({
        code: 'custom',
        message: 'Confirme la vérification du paiement.',
      })
    if (v.decision === 'rejected' && v.reason.length < 3)
      ctx.addIssue({ code: 'custom', message: 'Indique le motif du refus.' })
  })
export const cashPaymentSchema = z
  .object({
    id: z.string().uuid(),
    userId: z.string().trim().min(1).max(200),
    offerId: offerIdSchema,
    amount: z.coerce.number().int(),
    received: z.literal(true, { error: 'Confirme la réception des espèces.' }),
  })
  .superRefine((v, ctx) => {
    if (v.amount !== OFFERS.find((o) => o.id === v.offerId)?.price)
      ctx.addIssue({
        code: 'custom',
        message: 'Le montant reçu doit correspondre exactement à l’offre.',
      })
  })
export function isAdminIdentity(
  user: { email?: string; roles?: string[] } | null,
) {
  return (
    !!user &&
    user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() &&
    !!user.roles?.includes('admin')
  )
}
export const paymentStatusLabel = {
  pending: 'En attente',
  accepted: 'Accepté',
  rejected: 'Refusé',
} as const
export const formatBillingDate = (value: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value))
