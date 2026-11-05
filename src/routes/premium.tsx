import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { SupportContacts } from '@/components/app/support-contacts'
import { useEffect, useState } from 'react'
import { logout } from '@netlify/identity'
import { z } from 'zod'
import {
  ArrowLeft,
  Check,
  Copy,
  Crown,
  ImageUp,
  Loader2,
  MessageCircle,
  Receipt,
  X,
} from 'lucide-react'
import { compressImage } from '@/lib/image-client'
import { Logo } from '@/components/app/brand'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { BillingSummary } from '@/components/app/billing-summary'
import { getBilling, submitPayment } from '@/lib/billing.functions'
import { useNow } from '@/hooks/use-now'
import {
  FREE_MINUTES_PER_DAY,
  OFFERS,
  RECEIPT_NAMES_LABEL,
  VIP_WELCOME_DAYS,
  WAVE_NUMBER,
  WHATSAPP_DISPLAY,
  WHATSAPP_URL,
  formatDuration,
  formatFcfa,
  msUntilAbidjanMidnight,
  type Offer,
} from '@/lib/config'

export const Route = createFileRoute('/premium')({
  validateSearch: z.object({ raison: z.enum(['temps', 'essai']).optional() }),
  loader: () => getBilling(),
  head: () => ({
    meta: [
      { title: 'Offres Premium — Annales+' },
      {
        name: 'description',
        content:
          'Révise sans limite : 1 500 FCFA pour 1 mois ou 2 500 FCFA pour 3 mois, par Wave ou Orange Money.',
      },
      { property: 'og:title', content: 'Offres Premium — Annales+' },
      {
        property: 'og:description',
        content:
          '1 500 FCFA / 1 mois ou 2 500 FCFA / 3 mois. Wave et Orange Money.',
      },
    ],
  }),
  component: PremiumPage,
})

function PremiumPage() {
  const { raison } = Route.useSearch()
  const billing = Route.useLoaderData()
  const router = useRouter()
  const access = billing?.access ?? null
  const blocked = access?.status === 'bloque'
  const expired = blocked || (raison === 'temps' && !billing)
  const unlocked = !!raison && access?.status === 'abonne'
  const pending = billing?.payments.some((p) => p.status === 'pending')
  // Paiement envoyé : on revérifie toutes les 30 s pour débloquer dès la validation.
  useEffect(() => {
    if (!pending || access?.status === 'abonne') return
    const id = window.setInterval(() => void router.invalidate(), 30_000)
    return () => window.clearInterval(id)
  }, [access?.status, pending, router])
  const now = useNow(1000)
  const [receiptFor, setReceiptFor] = useState<Offer | null>(null)
  const minutes =
    access && 'minutesParJour' in access
      ? access.minutesParJour
      : FREE_MINUTES_PER_DAY

  return (
    <div className="min-h-svh bg-background">
      <header className="mx-auto flex h-16 max-w-content items-center justify-between px-4 sm:px-6">
        <Logo />
        {!expired && (
          <Link
            to="/accueil"
            className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" /> Retour
          </Link>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <section className="rounded-2xl border border-border bg-ink p-6 text-ink-foreground shadow-md sm:p-8">
          <h1 className="font-display text-3xl leading-tight font-extrabold sm:text-4xl">
            {unlocked
              ? 'Ton accès Premium est débloqué 🎉'
              : expired
                ? `Ton temps gratuit d’aujourd’hui (${minutes} min) est terminé`
                : 'Révise sans limite avec Premium'}
          </h1>
          <p className="mt-3 text-lg opacity-90">
            {unlocked
              ? 'Merci pour ton paiement ! Toute l’application est ouverte, sans limite de temps.'
              : expired
                ? pending
                  ? 'Ton reçu est en cours de validation. L’application se débloque automatiquement dès que l’administrateur l’a validé (cette page se met à jour toute seule).'
                  : 'Bravo pour ton travail aujourd’hui ! Pour continuer maintenant, choisis une offre et envoie ton reçu. Sinon, ton temps gratuit revient à minuit.'
                : `Accès illimité 24 h / 24 aux sujets de tous niveaux, leçons, tuteur IA, oral et examens. Sans abonnement, le forfait gratuit donne ${FREE_MINUTES_PER_DAY} minutes par jour avec des fonctions limitées.`}
          </p>
          {unlocked && (
            <Button
              asChild
              size="lg"
              className="mt-5 min-h-12 rounded-full px-6 font-bold"
            >
              <Link to="/accueil">Retourner à mes révisions</Link>
            </Button>
          )}
          {expired && (
            <p className="mt-5 inline-flex items-center gap-3 rounded-full bg-ink-foreground/10 px-4 py-2 text-sm">
              Temps gratuit de retour dans
              <span
                role="timer"
                className="font-mono text-lg font-bold text-primary"
              >
                {now
                  ? formatDuration(msUntilAbidjanMidnight(now), true)
                  : '--:--:--'}
              </span>
            </p>
          )}
        </section>

        <PlanComparison />

        <BillingSummary billing={billing} />
        <section
          aria-label="Avant d’envoyer ton reçu"
          className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-sm"
        >
          <h2 className="font-display text-lg font-extrabold">
            Avant d’envoyer ton reçu, vérifie ces 3 points
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              Le nom du bénéficiaire est bien{' '}
              <strong className="text-foreground">{RECEIPT_NAMES_LABEL}</strong>{' '}
              (tout autre nom sera refusé).
            </li>
            <li>Le montant correspond à l’offre choisie (1 500 ou 2 500 FCFA).</li>
            <li>La capture est nette : montant, date et nom bien lisibles.</li>
          </ol>
          <p className="mt-3 text-sm text-muted-foreground">
            Paie par Wave ou Orange Money, puis envoie la capture ici même. Pour
            payer en espèces sur place, présente ton identifiant de compte à
            l’administrateur.
          </p>
        </section>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {OFFERS.map((o) => (
            <OfferPayCard
              key={o.id}
              offer={o}
              onPaid={() => setReceiptFor(o)}
            />
          ))}
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Chaque abonnement est strictement personnel et lié à un seul compte.
          Le partage n’est pas autorisé.
        </p>

        <div className="mt-6 flex flex-col items-center gap-3">
          <Button
            asChild
            variant="outline"
            size="lg"
            className="min-h-12 rounded-full px-6 font-semibold"
          >
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-5" aria-hidden="true" /> Contacter
              le service client ({WHATSAPP_DISPLAY})
            </a>
          </Button>
          <SupportContacts compact className="flex justify-center" />
          {expired && (
            <div className="flex gap-4 text-sm text-muted-foreground">
              {billing && (
                <button
                  type="button"
                  className="min-h-11 content-center hover:text-foreground"
                  onClick={async () => {
                    try {
                      await logout()
                    } finally {
                      window.location.assign('/connexion')
                    }
                  }}
                >
                  Se déconnecter
                </button>
              )}
              <Link
                to="/confidentialite"
                className="min-h-11 content-center hover:text-foreground"
              >
                Confidentialité
              </Link>
            </div>
          )}
        </div>
      </main>

      <ReceiptDialog
        key={receiptFor?.id || 'closed'}
        offer={receiptFor}
        onClose={() => setReceiptFor(null)}
        connected={!!billing}
      />
    </div>
  )
}

const COMPARAISON: { label: string; gratuit: string | boolean; mensuel: string | boolean; trimestriel: string | boolean }[] = [
  { label: 'Temps par jour', gratuit: `${FREE_MINUTES_PER_DAY} min`, mensuel: 'Illimité', trimestriel: 'Illimité' },
  { label: 'Sujets niveaux 1 et 2', gratuit: true, mensuel: true, trimestriel: true },
  { label: 'Sujets niveaux 3 et 4 (approfondissement, olympiades)', gratuit: false, mensuel: true, trimestriel: true },
  { label: 'Échanges avec le tuteur IA', gratuit: '15 / jour', mensuel: '300 / jour', trimestriel: '300 / jour' },
  { label: '« Explique-moi cette leçon »', gratuit: 'Essentiel', mensuel: 'Détaillé', trimestriel: 'Détaillé + Approfondi' },
  { label: 'Nouvelles leçons à la demande', gratuit: '1 / jour', mensuel: '5 / jour', trimestriel: '5 / jour' },
  { label: 'Oral avec l’examinateur IA (note /20)', gratuit: false, mensuel: true, trimestriel: true },
  { label: 'Quiz du jour et rappels de révision', gratuit: true, mensuel: true, trimestriel: true },
]

/** Ce que chaque formule débloque, pour choisir en connaissance de cause. */
function PlanComparison() {
  const mensuel = OFFERS.find((o) => o.id === 'mensuel')!
  const trimestriel = OFFERS.find((o) => o.id === 'trimestriel')!
  const economie = mensuel.price * 3 - trimestriel.price
  const cell = (v: string | boolean) =>
    v === true ? (
      <Check className="mx-auto size-5 text-secondary" aria-label="Inclus" />
    ) : v === false ? (
      <X className="mx-auto size-5 text-muted-foreground" aria-label="Non inclus" />
    ) : (
      v
    )
  return (
    <section aria-labelledby="comparaison" className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 id="comparaison" className="font-display text-xl font-extrabold">
        Ce que Premium débloque
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Le Trimestriel te fait économiser {formatFcfa(economie)} par rapport à 3 mois en Mensuel, soit moins de{' '}
        {Math.ceil(trimestriel.price / trimestriel.days)} FCFA par jour. Sans abonnement, après les {VIP_WELCOME_DAYS} jours d’essai, tu gardes
        {' '}{FREE_MINUTES_PER_DAY} min/jour avec des fonctions limitées.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[30rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="py-2 pr-2 font-semibold">Fonction</th>
              <th scope="col" className="px-2 py-2 text-center font-semibold">Gratuit</th>
              <th scope="col" className="px-2 py-2 text-center font-semibold">Mensuel</th>
              <th scope="col" className="px-2 py-2 text-center font-semibold text-primary">
                <Crown className="mr-1 inline size-4" aria-hidden="true" />Trimestriel
              </th>
            </tr>
          </thead>
          <tbody>
            {COMPARAISON.map((r) => (
              <tr key={r.label} className="border-b border-border/60 last:border-0">
                <th scope="row" className="py-2 pr-2 text-left font-normal">{r.label}</th>
                <td className="px-2 py-2 text-center">{cell(r.gratuit)}</td>
                <td className="px-2 py-2 text-center">{cell(r.mensuel)}</td>
                <td className="px-2 py-2 text-center font-semibold">{cell(r.trimestriel)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function OfferPayCard({ offer, onPaid }: { offer: Offer; onPaid: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(WAVE_NUMBER)
      setCopied(true)
      toast.success('Numéro Wave copié')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Copie impossible. Note le numéro : ' + WAVE_NUMBER)
    }
  }

  return (
    <section
      aria-labelledby={`offre-${offer.id}`}
      className={
        offer.best
          ? 'relative rounded-2xl border-2 border-primary bg-card p-6 shadow-md'
          : 'rounded-2xl border border-border bg-card p-6 shadow-sm'
      }
    >
      {offer.best && (
        <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-xs font-bold text-primary-foreground">
          Meilleur prix
        </span>
      )}
      <h2
        id={`offre-${offer.id}`}
        className="text-sm font-semibold text-muted-foreground"
      >
        {offer.label} · {offer.durationLabel}
      </h2>
      <p className="mt-1 font-display text-4xl font-extrabold">
        {formatFcfa(offer.price)}
      </p>
      <p className="mt-1 text-sm">
        Illimité 24 h / 24 pendant {offer.durationLabel} ({offer.days} jours)
      </p>

      <div className="mt-5 space-y-3">
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-sm font-semibold">Payer avec Wave</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="font-mono text-lg font-bold tracking-wide">
              {WAVE_NUMBER}
            </span>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={copy}
              aria-label="Copier le numéro Wave"
            >
              {copied ? (
                <Check className="size-4" aria-hidden="true" />
              ) : (
                <Copy className="size-4" aria-hidden="true" />
              )}
              {copied ? 'Copié' : 'Copier'}
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Envoie exactement {formatFcfa(offer.price)} à ce numéro.
          </p>
        </div>
        <Button
          asChild
          variant="secondary"
          size="lg"
          className="min-h-12 w-full rounded-xl font-bold"
        >
          <a
            href={offer.orangeMoneyUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Payer avec Orange Money · {formatFcfa(offer.price)}
          </a>
        </Button>
        <Button
          size="lg"
          className="min-h-12 w-full rounded-xl font-bold"
          onClick={onPaid}
        >
          <Receipt className="size-5" aria-hidden="true" /> J’ai payé, envoyer
          mon reçu
        </Button>
      </div>
    </section>
  )
}

/** Déclaration du paiement avec la capture du reçu, vérifiée automatiquement puis validée par l'admin. */
function ReceiptDialog({
  offer,
  onClose,
  connected,
}: {
  offer: Offer | null
  onClose: () => void
  connected: boolean
}) {
  const router = useRouter()
  const [txId, setTxId] = useState('')
  const [method, setMethod] = useState<'Wave' | 'Orange Money'>('Wave')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<{ id: string; alertes: number } | null>(
    null,
  )
  const [image, setImage] = useState<Awaited<
    ReturnType<typeof compressImage>
  > | null>(null)
  const valid = /^[A-Za-z0-9.\-_]{6,40}$/.test(txId.trim()) && !!image
  const noms = RECEIPT_NAMES_LABEL
  const message = offer
    ? `Bonjour, j’ai payé l’offre Annales+ ${offer.label} (${formatFcfa(offer.price)} – ${offer.durationLabel}) par ${method}. Dossier : ${saved?.id ?? ''}. ID de transaction : ${txId.trim().toUpperCase()}.`
    : ''
  return (
    <Dialog open={!!offer} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {saved ? 'Reçu reçu, paiement en attente' : 'Envoyer mon reçu'}
          </DialogTitle>
          <DialogDescription>
            Le reçu doit porter le nom du bénéficiaire <strong>{noms}</strong>.
            L’application le vérifie tout de suite, puis l’administrateur
            confirme le versement et active ton accès.
          </DialogDescription>
        </DialogHeader>
        {!connected ? (
          <div className="space-y-4">
            <p>
              Connecte-toi et complète ton profil pour rattacher ce paiement à
              ton compte.
            </p>
            <Button asChild className="min-h-11">
              <Link to="/connexion" search={{ retour: '/premium' }}>
                Me connecter
              </Link>
            </Button>
          </div>
        ) : saved ? (
          <div className="space-y-4">
            <p role="status" className="font-semibold text-secondary">
              Ton reçu porte bien le nom du bénéficiaire. Il attend la
              validation de l’administrateur : ton accès s’ouvre
              automatiquement dès qu’il est validé.
            </p>
            {saved.alertes > 0 && (
              <p className="rounded-xl bg-muted p-3 text-sm">
                Certains détails n’ont pas pu être lus automatiquement (montant
                ou ID). L’administrateur les vérifiera à la main.
              </p>
            )}
            <p className="break-all text-xs text-muted-foreground">
              Dossier : {saved.id}
            </p>
            <Button asChild variant="outline" className="min-h-11 w-full">
              <a
                href={`${WHATSAPP_URL}?text=${encodeURIComponent(message)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="size-5" aria-hidden="true" /> Une
                question ? Écrire au service client
              </a>
            </Button>
            <Button className="min-h-11 w-full" onClick={onClose}>
              Terminer
            </Button>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault()
              if (!offer || !valid || pending || !image) return
              setPending(true)
              setError('')
              try {
                const result = await submitPayment({
                  data: {
                    offerId: offer.id,
                    method,
                    reference: txId,
                    receipt: { mediaType: image.mediaType, data: image.data },
                  },
                })
                setSaved({ id: result.id, alertes: result.alertes })
                try {
                  await router.invalidate()
                } catch {
                  setError(
                    'Le paiement est déclaré. Actualise la page pour mettre à jour le suivi.',
                  )
                }
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : 'Envoi impossible. Réessaie.',
                )
              } finally {
                setPending(false)
              }
            }}
          >
            <fieldset disabled={pending} className="space-y-4">
              <legend className="text-sm font-medium">Moyen de paiement</legend>
              <div className="mt-2 flex gap-2">
                {(['Wave', 'Orange Money'] as const).map((m) => (
                  <Button
                    key={m}
                    type="button"
                    variant={method === m ? 'default' : 'outline'}
                    aria-pressed={method === m}
                    className="min-h-11 flex-1"
                    onClick={() => setMethod(m)}
                  >
                    {m}
                  </Button>
                ))}
              </div>
              <div className="space-y-2">
                <Label htmlFor="txid">ID de transaction</Label>
                <Input
                  id="txid"
                  value={txId}
                  onChange={(e) => setTxId(e.target.value)}
                  maxLength={40}
                  required
                  placeholder="Celui indiqué sur ton reçu"
                  className="min-h-11"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recu">Capture du reçu</Label>
                <label
                  htmlFor="recu"
                  className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-background p-3 text-center text-sm hover:border-primary"
                >
                  {image ? (
                    <img
                      src={image.preview}
                      alt="Aperçu du reçu"
                      className="max-h-48 rounded-lg object-contain"
                    />
                  ) : (
                    <>
                      <ImageUp className="size-6" aria-hidden="true" />
                      Choisir la capture d’écran du reçu
                    </>
                  )}
                </label>
                <input
                  id="recu"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setError('')
                    try {
                      setImage(await compressImage(file))
                    } catch (err) {
                      setImage(null)
                      setError(
                        err instanceof Error ? err.message : 'Image illisible.',
                      )
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  On doit y voir le nom <strong>{noms}</strong>, le montant (
                  {offer ? formatFcfa(offer.price) : ''}) et l’ID de
                  transaction.
                </p>
              </div>
              <Button
                type="submit"
                disabled={!valid || pending}
                className="min-h-12 w-full rounded-xl font-bold"
              >
                {pending ? (
                  <>
                    <Loader2
                      className="size-4 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                    Vérification du reçu…
                  </>
                ) : (
                  'Envoyer mon reçu'
                )}
              </Button>
            </fieldset>
          </form>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
