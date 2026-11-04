import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { formatBillingDate, paymentStatusLabel } from '@/lib/billing'
import { OFFERS, WHATSAPP_URL, formatFcfa } from '@/lib/config'
import type { getBilling } from '@/lib/billing.functions'

export function BillingSummary({
  billing,
}: {
  billing: Awaited<ReturnType<typeof getBilling>>
}) {
  if (!billing)
    return (
      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <p>Connecte-toi pour déclarer ton paiement et suivre son traitement.</p>
        <Button asChild className="mt-3 min-h-11">
          <Link to="/connexion" search={{ retour: '/premium' }}>
            Me connecter
          </Link>
        </Button>
      </section>
    )
  return (
    <section className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-2xl font-bold">
        Mon abonnement et mes paiements
      </h2>
      {billing.subscription ? (
        <p className="text-sm">
          <strong>
            {billing.subscription.active
              ? 'Premium actif'
              : 'Abonnement expiré'}
          </strong>{' '}
          ·{' '}
          {OFFERS.find((o) => o.id === billing.subscription?.offerId)?.label ??
            'Accès offert'}{' '}
          · {billing.subscription.active ? 'jusqu’au' : 'depuis le'}{' '}
          {formatBillingDate(billing.subscription.expiresAt)} (Abidjan)
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Aucun abonnement payant activé pour le moment.
        </p>
      )}
      <p className="break-all text-xs text-muted-foreground">
        Ton identifiant de compte :{' '}
        <span className="font-mono">{billing.userId}</span>. Présente-le à
        l’administrateur pour un paiement en espèces sur place.
      </p>
      {!billing.payments.length ? (
        <p className="text-sm text-muted-foreground">Aucun paiement déclaré.</p>
      ) : (
        <ul className="divide-y divide-border">
          {billing.payments.map((p) => (
            <li key={p.id} className="space-y-1 py-3">
              <div className="flex flex-wrap justify-between gap-2">
                <p className="text-sm font-semibold">
                  {formatFcfa(p.amount)} · {p.method}
                </p>
                <span className="text-sm font-semibold text-secondary">
                  {paymentStatusLabel[
                    p.status as keyof typeof paymentStatusLabel
                  ] || p.status}
                </span>
              </div>
              <p className="break-all text-xs text-muted-foreground">
                {formatBillingDate(p.createdAt)} · {p.reference}
              </p>
              {p.status === 'pending' && (
                <>
                  <p className="text-sm">
                    Ton paiement attend la vérification de l’administrateur.
                  </p>
                  <a
                    href={`${WHATSAPP_URL}?text=${encodeURIComponent(`Bonjour, voici mon reçu Annales+. Dossier : ${p.id}. Compte : ${billing.userId}. Transaction : ${p.reference}. Montant : ${formatFcfa(p.amount)} par ${p.method}. Je joins la capture du reçu.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline"
                  >
                    Transmettre le reçu sur WhatsApp
                  </a>
                </>
              )}
              {p.reason && (
                <p className="text-sm text-destructive">
                  Motif du refus : {p.reason}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {billing.isAdmin && (
        <Button asChild variant="outline" className="min-h-11">
          <Link to="/admin" search={{ page: 0 }}>
            Ouvrir l’administration
          </Link>
        </Button>
      )}
    </section>
  )
}
