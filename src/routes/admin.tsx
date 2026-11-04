import { AdminModules } from '@/components/admin/admin-modules'
import {
  createFileRoute,
  Link,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { useState } from 'react'
import { logout } from '@netlify/identity'
import {
  Banknote,
  CheckCheck,
  Flag,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { Logo } from '@/components/app/brand'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ADMIN_EMAIL, OFFERS, WHATSAPP_URL, formatFcfa } from '@/lib/config'
import { formatBillingDate, paymentStatusLabel } from '@/lib/billing'
import {
  findStudents,
  getAdminAccess,
  getAdminDashboard,
  getReceiptImage,
  recordCashPayment,
  reviewPayment,
} from '@/lib/billing.functions'
import { getAiOverview } from '@/lib/ai.functions'
import { controlRefresh, getRefreshOverview } from '@/lib/sujets.functions'

type Dashboard = Awaited<ReturnType<typeof getAdminDashboard>>
type Student = Awaited<ReturnType<typeof findStudents>>[number]

export const Route = createFileRoute('/admin')({
  validateSearch: (s: Record<string, unknown>) => ({
    page: Math.min(100000, Math.max(0, Math.floor(Number(s.page) || 0))),
  }),
  beforeLoad: async () => {
    const access = await getAdminAccess()
    if (access === 'anonymous')
      throw redirect({ to: '/connexion', search: { retour: '/admin' } })
    return { access }
  },
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: async ({ context, deps }) => {
    if (context.access !== 'allowed') return null
    const [dashboard, ai, refresh] = await Promise.all([
      getAdminDashboard({ data: deps }),
      getAiOverview().catch(() => null),
      getRefreshOverview().catch(() => null),
    ])
    return { ...dashboard, ai, refresh }
  },
  head: () => ({
    meta: [
      { title: 'Administration — Annales+' },
      {
        name: 'description',
        content: 'Gestion sécurisée des paiements et des abonnements Annales+.',
      },
      { name: 'robots', content: 'noindex, nofollow' },
      { property: 'og:title', content: 'Administration — Annales+' },
      {
        property: 'og:description',
        content: 'Espace de gestion réservé à l’administrateur.',
      },
    ],
  }),
  component: Administration,
})

function Administration() {
  const { access } = Route.useRouteContext()
  const data = Route.useLoaderData()
  const router = useRouter()
  const [refreshError, setRefreshError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  return (
    <div className="min-h-svh bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Logo />
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await logout()
                  window.location.assign('/connexion')
                } catch {
                  setRefreshError('La déconnexion a échoué. Réessaie.')
                }
              }}
            >
              Se déconnecter
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-content space-y-7 px-4 py-8 sm:px-6">
        <section className="rounded-2xl bg-ink p-6 text-ink-foreground sm:p-8">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="size-4" aria-hidden="true" /> Administration
            Annales+
          </p>
          <h1 className="mt-3 font-display text-3xl font-extrabold sm:text-4xl">
            Le carnet des paiements
          </h1>
          <p className="mt-3 max-w-2xl opacity-90">
            Vérifie les versements, enregistre les espèces reçues et active les
            abonnements des élèves.
          </p>
        </section>
        {refreshError && (
          <p role="alert" className="text-destructive">
            {refreshError}
          </p>
        )}
        {access === 'setup' ? (
          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display text-2xl">
              Confirme ton adresse e-mail
            </h2>
            <p>
              L’adresse {ADMIN_EMAIL} est reconnue. L’accès administrateur
              s’ouvre automatiquement dès que cette adresse est confirmée :
              clique sur le lien reçu par e-mail, puis reconnecte-toi.
            </p>
          </section>
        ) : access === 'forbidden' ? (
          <section
            role="alert"
            className="rounded-2xl border border-border bg-card p-6"
          >
            <h2 className="font-display text-2xl">Accès réservé</h2>
            <p className="mt-3">
              Ce compte n’est pas autorisé à administrer Annales+.
            </p>
          </section>
        ) : (
          data && (
            <>
              <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
                <section className="rounded-2xl border border-primary/40 bg-primary/10 p-6">
                  <p className="text-sm font-semibold">À vérifier</p>
                  <p className="mt-2 font-display text-5xl font-extrabold">
                    {data.counts.pending}
                    <span className="ml-3 font-sans text-base font-medium">
                      paiement{data.counts.pending > 1 ? 's' : ''} en attente
                    </span>
                  </p>
                  <p className="mt-4 text-sm text-muted-foreground">
                    Compare chaque transaction au relevé Wave ou Orange Money
                    avant de l’accepter.
                  </p>
                </section>
                <section className="grid grid-cols-2 gap-4 rounded-2xl border border-border bg-card p-6">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Encaissements validés
                    </p>
                    <p className="mt-2 font-display text-2xl font-bold">
                      {formatFcfa(data.counts.total)}
                    </p>
                    <p className="mt-1 text-sm">
                      {data.counts.accepted} paiement(s)
                    </p>
                  </div>
                  <div className="border-l border-border pl-4">
                    <p className="text-sm text-muted-foreground">
                      Profils élèves
                    </p>
                    <p className="mt-2 font-display text-3xl font-bold">
                      {data.counts.students}
                    </p>
                  </div>
                </section>
              </div>
              <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
                <div className="space-y-6">
                  <PaymentList data={data} />
                  <AuditList entries={data.audit} />
                </div>
                <CashDesk />
              </div>
              <RefreshPanel refresh={data.refresh} />
              <AiPanel ai={data.ai} />
              <AdminModules />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
                <p className="text-sm text-muted-foreground">
                  Données réelles · Horaires d’Abidjan (UTC+0)
                </p>
                <Button
                  variant="outline"
                  disabled={refreshing}
                  onClick={async () => {
                    setRefreshing(true)
                    setRefreshError('')
                    try {
                      await router.invalidate()
                    } catch {
                      setRefreshError('Actualisation impossible. Réessaie.')
                    } finally {
                      setRefreshing(false)
                    }
                  }}
                >
                  <RefreshCw className="size-4" aria-hidden="true" />{' '}
                  {refreshing ? 'Actualisation…' : 'Actualiser'}
                </Button>
              </div>
            </>
          )
        )}
      </main>
    </div>
  )
}

function PaymentList({ data }: { data: Dashboard }) {
  const { page } = Route.useSearch()
  const [selected, setSelected] = useState<
    Dashboard['payments'][number] | null
  >(null)
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-bold">Paiements déclarés</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Les déclarations en ligne attendent ta vérification. Les espèces sont
          validées lors de l’encaissement.
        </p>
      </div>
      {!data.payments.length && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <CheckCheck
            className="mx-auto size-8 text-secondary"
            aria-hidden="true"
          />
          <p className="mt-3 font-semibold">Aucun paiement sur cette page</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Les déclarations des élèves apparaissent ici après leur
            enregistrement depuis Premium.
          </p>
        </div>
      )}
      <ul className="space-y-3">
        {data.payments.map((p) => (
          <li
            key={p.id}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold">
                  {p.firstName}{' '}
                  <span className="font-sans text-sm font-normal text-muted-foreground">
                    · {p.classe} {p.serie}
                  </span>
                </h3>
                {p.email && (
                  <p className="break-all text-sm text-muted-foreground">
                    {p.email}
                  </p>
                )}
              </div>
              <span
                className={
                  p.status === 'accepted'
                    ? 'rounded-full bg-secondary/10 px-3 py-1 text-sm font-semibold text-secondary'
                    : 'rounded-full bg-muted px-3 py-1 text-sm font-semibold'
                }
              >
                {paymentStatusLabel[
                  p.status as keyof typeof paymentStatusLabel
                ] || p.status}
              </span>
            </div>
            <p className="mt-3 font-bold">
              {formatFcfa(p.amount)} ·{' '}
              {OFFERS.find((o) => o.id === p.offerId)?.label} · {p.method}
            </p>
            <p className="mt-1 break-all font-mono text-sm">
              Transaction : {p.reference}
            </p>
            <p className="mt-1 break-all text-xs text-muted-foreground">
              Compte élève : {p.userId}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {formatBillingDate(p.createdAt)} · Dossier {p.id}
            </p>
            {p.reason && (
              <p className="mt-2 text-sm text-destructive">
                Motif : {p.reason}
              </p>
            )}
            {p.status === 'pending' && (
              <SentinelVerdict verdict={p.sentinelle} />
            )}
            <ReceiptCheckView
              paymentId={p.id}
              hasReceipt={p.recu}
              check={p.controleRecu}
            />
            {p.status === 'pending' && (
              <Button
                className="mt-4 min-h-11 rounded-full"
                onClick={() => setSelected(p)}
              >
                Vérifier ce paiement
              </Button>
            )}
          </li>
        ))}
      </ul>
      <nav
        aria-label="Pages des paiements"
        className="flex items-center justify-between gap-2"
      >
        <Button asChild variant="outline" disabled={page === 0}>
          {page > 0 ? (
            <Link to="/admin" search={{ page: page - 1 }}>
              Précédent
            </Link>
          ) : (
            <span>Précédent</span>
          )}
        </Button>
        <span className="text-sm">Page {page + 1}</span>
        <Button asChild variant="outline" disabled={!data.hasNext}>
          {data.hasNext ? (
            <Link to="/admin" search={{ page: page + 1 }}>
              Suivant
            </Link>
          ) : (
            <span>Suivant</span>
          )}
        </Button>
      </nav>
      {selected && (
        <ReviewDialog
          key={selected.id}
          payment={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  )
}

function ReviewDialog({
  payment,
  onClose,
}: {
  payment: Dashboard['payments'][number]
  onClose: () => void
}) {
  const router = useRouter()
  const [verified, setVerified] = useState(false)
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  async function decide(decision: 'accepted' | 'rejected') {
    if (pending || saved) return
    setPending(true)
    setError('')
    try {
      await reviewPayment({
        data: { id: payment.id, decision, verified, reason },
      })
      setSaved(true)
      try {
        await router.invalidate()
        onClose()
      } catch {
        setError(
          'La décision est enregistrée. Actualise la page pour voir le nouvel état.',
        )
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Enregistrement impossible. Réessaie.',
      )
    } finally {
      setPending(false)
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vérifier le paiement de {payment.firstName}</DialogTitle>
          <DialogDescription>
            {formatFcfa(payment.amount)} · {payment.method} ·{' '}
            {payment.reference}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm">
          Consulte le relevé du compte destinataire et le reçu transmis par
          WhatsApp. Vérifie le montant, le destinataire, la date et l’ID. Une
          capture seule ne confirme pas l’encaissement.
        </p>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center font-semibold text-primary underline"
        >
          Ouvrir le service client WhatsApp
        </a>
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={verified}
            onChange={(e) => setVerified(e.target.checked)}
            disabled={pending || saved}
            className="mt-1 size-5 shrink-0 accent-primary"
          />
          J’ai retrouvé cette transaction sur le relevé et confirmé le montant
          reçu. L’acceptation active ou prolonge l’abonnement.
        </label>
        <label className="space-y-2 text-sm font-semibold">
          Motif du refus (obligatoire pour refuser)
          <textarea
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={pending || saved}
            className="mt-2 min-h-24 w-full rounded-xl border border-input bg-background p-3 font-normal"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={!verified || pending || saved}
            onClick={() => void decide('accepted')}
          >
            {pending ? 'Enregistrement…' : 'Accepter et activer'}
          </Button>
          <Button
            variant="destructive"
            disabled={reason.trim().length < 3 || pending || saved}
            onClick={() => void decide('rejected')}
          >
            Refuser
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CashDesk() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [searched, setSearched] = useState(false)
  const [selected, setSelected] = useState<Student | null>(null)
  const [offerId, setOfferId] = useState<'mensuel' | 'trimestriel'>('mensuel')
  const [amount, setAmount] = useState('')
  const [received, setReceived] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [id, setId] = useState('')
  const offer = OFFERS.find((o) => o.id === offerId)!
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 grid size-11 place-items-center rounded-xl bg-secondary/10 text-secondary">
        <Banknote className="size-6" aria-hidden="true" />
      </div>
      <h2 className="font-display text-2xl font-bold">Espèces sur place</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Retrouve le compte de l’élève présent avant de recevoir son paiement. Il
        retrouve son identifiant dans son profil.
      </p>
      <form
        className="mt-5 space-y-3"
        onSubmit={async (event) => {
          event.preventDefault()
          if (pending) return
          setPending(true)
          setError('')
          setSuccess('')
          setSelected(null)
          setSearched(false)
          try {
            setStudents(await findStudents({ data: { query } }))
            setSearched(true)
          } catch {
            setError('Recherche impossible. Réessaie.')
          } finally {
            setPending(false)
          }
        }}
      >
        <label className="block space-y-2 text-sm font-semibold">
          Prénom ou identifiant du compte
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            minLength={2}
            maxLength={100}
            required
            className="min-h-11"
          />
        </label>
        <Button
          type="submit"
          variant="outline"
          disabled={pending}
          className="min-h-11 w-full"
        >
          {pending ? 'Patiente…' : 'Rechercher un élève'}
        </Button>
      </form>
      {searched && !students.length && (
        <p className="mt-4 text-sm">
          Aucun profil trouvé. L’élève doit créer et compléter son compte.
        </p>
      )}
      {!!students.length && (
        <div
          className="mt-4 max-h-72 space-y-2 overflow-y-auto"
          aria-label="Résultats de recherche"
        >
          {students.map((s) => (
            <button
              type="button"
              key={s.userId}
              disabled={pending}
              aria-pressed={selected?.userId === s.userId}
              className={
                selected?.userId === s.userId
                  ? 'min-h-11 w-full rounded-xl border-2 border-primary bg-primary/10 p-3 text-left'
                  : 'min-h-11 w-full rounded-xl border border-border p-3 text-left hover:bg-muted'
              }
              onClick={() => {
                setSelected(s)
                setId(crypto.randomUUID())
                setReceived(false)
                setAmount('')
                setSuccess('')
                setError('')
              }}
            >
              <span className="block font-semibold">
                {s.firstName} · {s.classe} {s.serie}
              </span>
              <span className="mt-1 block break-all font-mono text-xs text-muted-foreground">
                {s.userId}
              </span>
            </button>
          ))}
        </div>
      )}
      {selected && (
        <form
          className="mt-5 space-y-4 border-t border-border pt-5"
          onSubmit={async (event) => {
            event.preventDefault()
            if (pending || !received) return
            setPending(true)
            setError('')
            setSuccess('')
            try {
              const result = await recordCashPayment({
                data: {
                  id,
                  userId: selected.userId,
                  offerId,
                  amount: Number(amount),
                  received: true,
                },
              })
              setSuccess(
                `Paiement encaissé et abonnement activé. Reçu : ${result.id}.`,
              )
              setSelected(null)
              setStudents([])
              setSearched(false)
              setQuery('')
              try {
                await router.invalidate()
              } catch {
                setError(
                  'Paiement enregistré. Actualise la page pour mettre à jour les compteurs.',
                )
              }
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : 'Enregistrement impossible. Réessaie.',
              )
            } finally {
              setPending(false)
            }
          }}
        >
          <p className="text-sm font-semibold">Élève : {selected.firstName}</p>
          <p className="break-all text-xs">Identifiant : {selected.userId}</p>
          {selected.expiresAt && (
            <p className="text-sm text-muted-foreground">
              Échéance actuelle : {formatBillingDate(selected.expiresAt)}
            </p>
          )}
          <fieldset disabled={pending} className="space-y-4">
            <label className="block space-y-2 text-sm font-semibold">
              Offre
              <select
                value={offerId}
                onChange={(e) => {
                  setOfferId(e.target.value as typeof offerId)
                  setReceived(false)
                  setId(crypto.randomUUID())
                }}
                className="min-h-11 w-full rounded-xl border border-input bg-background px-3"
              >
                {OFFERS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label} · {formatFcfa(o.price)} · {o.days} jours
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2 text-sm font-semibold">
              Montant reçu en FCFA
              <Input
                type="number"
                min={offer.price}
                max={offer.price}
                step={1}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="min-h-11"
              />
            </label>
            <label className="flex min-h-11 items-start gap-3 text-sm">
              <input
                type="checkbox"
                required
                checked={received}
                onChange={(e) => setReceived(e.target.checked)}
                className="mt-1 size-5 shrink-0 accent-primary"
              />
              J’ai reçu {formatFcfa(offer.price)} en espèces et vérifié avec
              l’élève l’identifiant de son compte.
            </label>
            <Button
              type="submit"
              disabled={pending || !received || Number(amount) !== offer.price}
              className="min-h-12 w-full rounded-xl"
            >
              {pending ? 'Enregistrement…' : 'Encaisser et activer'}
            </Button>
          </fieldset>
          <p className="text-xs text-muted-foreground">
            {offer.days} jours sont ajoutés à partir de maintenant ou de la fin
            de l’abonnement en cours.
          </p>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="mt-4 break-words text-sm font-semibold text-secondary"
        >
          {success}
        </p>
      )}
    </section>
  )
}

function AuditList({ entries }: { entries: Dashboard['audit'] }) {
  const actions: Record<string, string> = {
    submitted: 'Déclaration en ligne',
    accepted: 'Paiement accepté',
    rejected: 'Paiement refusé',
    cash_accepted: 'Espèces encaissées',
  }
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-xl font-bold">
        Journal des dernières opérations
      </h2>
      {!entries.length ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Aucune opération enregistrée.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {entries.map((a, i) => (
            <li key={i} className="py-3">
              <p className="text-sm font-semibold">
                {actions[a.action] || a.action}
              </p>
              <p className="mt-1 break-all text-xs text-muted-foreground">
                {formatBillingDate(a.createdAt)} · {a.paymentId}
              </p>
              {a.reason && <p className="mt-1 text-sm">{a.reason}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function AiPanel({
  ai,
}: {
  ai: Awaited<ReturnType<typeof getAiOverview>> | null
}) {
  return (
    <section
      aria-labelledby="ia-admin"
      className="space-y-4 rounded-2xl border border-border bg-card p-6"
    >
      <h2
        id="ia-admin"
        className="flex items-center gap-2 font-display text-2xl"
      >
        <Sparkles className="size-5" aria-hidden="true" /> IA aujourd’hui
      </h2>
      {!ai ? (
        <p className="text-sm text-muted-foreground">
          Les statistiques de l’IA sont indisponibles pour le moment.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ['Réponses', ai.today.ok],
              ['Erreurs', ai.today.errors],
              ['Élèves', ai.today.students],
              [
                'Jetons (entrée / sortie)',
                `${ai.today.inputTokens.toLocaleString('fr-FR')} / ${ai.today.outputTokens.toLocaleString('fr-FR')}`,
              ],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="mt-1 font-display text-2xl font-bold">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <div>
            <h3 className="flex items-center gap-2 font-semibold">
              <Flag className="size-4" aria-hidden="true" /> Réponses signalées
              par les élèves
            </h3>
            {ai.reports.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Aucun signalement pour l’instant.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {ai.reports.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-xl border border-border p-4 text-sm"
                  >
                    <p className="text-muted-foreground">
                      {formatBillingDate(r.createdAt)} · {r.kind}
                      {r.firstName ? ` · ${r.firstName}` : ''}
                    </p>
                    {r.question && (
                      <p className="mt-2">
                        <span className="font-semibold">Question : </span>
                        {r.question}
                      </p>
                    )}
                    <p className="mt-2 line-clamp-6 whitespace-pre-line">
                      <span className="font-semibold">Réponse : </span>
                      {r.answer}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  )
}

const RUN_STATUS: Record<string, string> = {
  queued: 'En attente',
  running: 'En cours',
  done: 'Terminée',
  failed: 'Échouée',
  cancelled: 'Annulée',
}
const RUN_TRIGGER: Record<string, string> = {
  planifie: 'Planifiée 03h00',
  admin: 'Lancée par l’admin',
  eleve: 'Première visite d’une classe',
}

function RefreshPanel({
  refresh,
}: {
  refresh: Awaited<ReturnType<typeof getRefreshOverview>> | null
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const act = async (data: Parameters<typeof controlRefresh>[0]['data']) => {
    setPending(true)
    setError('')
    try {
      await controlRefresh({ data })
      await router.invalidate()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action impossible.')
    } finally {
      setPending(false)
    }
  }
  const [quota, setQuota] = useState(String(refresh?.quota ?? ''))
  return (
    <section
      aria-labelledby="actualisation"
      className="space-y-4 rounded-2xl border border-border bg-card p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="actualisation"
          className="flex items-center gap-2 font-display text-2xl"
        >
          <RefreshCw className="size-5" aria-hidden="true" /> Grande
          Actualisation
        </h2>
        {refresh && (
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={pending || refresh.paused}
              onClick={() => void act({ action: 'lancer' })}
            >
              Lancer maintenant
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() =>
                void act({ action: 'pause', paused: !refresh.paused })
              }
            >
              {refresh.paused ? 'Reprendre' : 'Mettre en pause'}
            </Button>
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!refresh ? (
        <p className="text-sm text-muted-foreground">
          L’état de l’actualisation est indisponible pour le moment.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {refresh.paused
              ? 'En pause : aucune génération planifiée ni automatique.'
              : `Chaque nuit à 03h00 (Abidjan) : objectif ${refresh.target} sujets par classe et série, partagés entre les matières (principales ×2). Chaque sujet est remplacé au bout de ${refresh.renewDays} jours ; les anciens sont archivés, jamais supprimés.`}
          </p>
          <ul className="grid gap-2 text-sm sm:grid-cols-4">
            <li className="rounded-xl border border-border p-3">
              Créés aujourd’hui
              <strong className="block font-display text-xl">
                {refresh.createdToday} / {refresh.quota}
              </strong>
            </li>
            <li className="rounded-xl border border-border p-3">
              Nécessaire par jour
              <strong className="block font-display text-xl">
                {refresh.neededPerDay}
              </strong>
            </li>
            <li className="rounded-xl border border-border p-3">
              Quiz du jour prêts
              <strong className="block font-display text-xl">
                {refresh.quizzesToday}
              </strong>
            </li>
            <li className="rounded-xl border border-border p-3">
              Leçons rédigées
              <strong className="block font-display text-xl">
                {refresh.lessonsReady}
              </strong>
            </li>
          </ul>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const value = Math.floor(Number(quota))
              if (Number.isFinite(value) && value >= 0 && value <= 5000)
                void act({ action: 'quota', value })
            }}
          >
            <label className="text-sm font-semibold" htmlFor="quota-jour">
              Plafond de sujets générés par jour
              <input
                id="quota-jour"
                type="number"
                min={0}
                max={5000}
                value={quota}
                onChange={(e) => setQuota(e.target.value)}
                className="mt-1 block min-h-11 w-32 rounded-xl border border-border bg-background px-3"
              />
            </label>
            <Button type="submit" variant="outline" disabled={pending}>
              Enregistrer
            </Button>
            <p className="w-full text-xs text-muted-foreground">
              Chaque sujet consomme des crédits d’IA. Si le plafond est
              inférieur au besoin quotidien, les classes se remplissent plus
              lentement (classes d’examen d’abord) et les sujets restent en
              ligne plus de {refresh.renewDays} jours.
            </p>
          </form>
          {refresh.perClass.length > 0 && (
            <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {refresh.perClass.map((c) => (
                <li
                  key={c.classe + c.serie}
                  className="rounded-xl border border-border p-3"
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold">
                      {c.classe} {c.serie}
                    </span>
                    <span>
                      <strong>{c.active}</strong> / {refresh.target}
                    </span>
                  </div>
                  <div
                    className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-label={`Sujets de moins de ${refresh.renewDays} jours en ${c.classe} ${c.serie}`}
                    aria-valuemin={0}
                    aria-valuemax={refresh.target}
                    aria-valuenow={c.fresh}
                  >
                    <div
                      className="h-full bg-secondary"
                      style={{
                        width: `${Math.min(100, (c.fresh / refresh.target) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.fresh} de moins de {refresh.renewDays} jours
                  </p>
                </li>
              ))}
            </ul>
          )}
          {refresh.runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune exécution pour l’instant.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {refresh.runs.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"
                >
                  <span>
                    {formatBillingDate(r.createdAt)} ·{' '}
                    {RUN_TRIGGER[r.trigger] ?? r.trigger} ·{' '}
                    {r.scope === 'toutes'
                      ? 'toutes les classes'
                      : r.scope
                          .replace(/^(classe|matiere):/, '')
                          .replaceAll('|', ' ')}
                  </span>
                  <span className="flex items-center gap-3">
                    <strong>{RUN_STATUS[r.status] ?? r.status}</strong>
                    {r.created} créé{r.created > 1 ? 's' : ''}
                    {r.failed > 0 && ` · ${r.failed} échec(s)`}
                    {(r.status === 'running' || r.status === 'queued') && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          void act({ action: 'annuler', id: r.id })
                        }
                      >
                        Annuler
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

/** Avis de la Sentinelle sur un paiement en attente (faits relus en base). */
function SentinelVerdict({
  verdict,
}: {
  verdict: Dashboard['payments'][number]['sentinelle']
}) {
  if (!verdict) return null
  if (!verdict.gravite)
    return (
      <p className="mt-3 flex items-center gap-2 rounded-xl border border-secondary/40 bg-secondary/10 p-3 text-sm">
        <ShieldCheck className="size-4 text-secondary" aria-hidden="true" />
        Sentinelle : aucun signal suspect. Vérifie quand même le relevé Wave /
        Orange Money avant d’accepter.
      </p>
    )
  return (
    <div
      className={
        verdict.gravite === 'haute'
          ? 'mt-3 rounded-xl border border-destructive bg-destructive/10 p-3 text-sm'
          : 'mt-3 rounded-xl border border-primary bg-primary/10 p-3 text-sm'
      }
    >
      <p className="flex items-center gap-2 font-semibold">
        <ShieldCheck className="size-4" aria-hidden="true" />
        Sentinelle · risque{' '}
        {verdict.gravite === 'haute'
          ? 'élevé'
          : verdict.gravite === 'moyenne'
            ? 'moyen'
            : 'faible'}{' '}
        ({verdict.score}/100)
      </p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {verdict.motifs.map((m) => (
          <li key={m.texte}>{m.texte}</li>
        ))}
      </ul>
    </div>
  )
}

/** Reçu envoyé dans l'application et lecture automatique (bénéficiaire, montant, ID). */
function ReceiptCheckView({
  paymentId,
  hasReceipt,
  check,
}: {
  paymentId: string
  hasReceipt: boolean
  check: Dashboard['payments'][number]['controleRecu']
}) {
  const [image, setImage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!hasReceipt && !check) return null
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-border bg-background p-3 text-sm">
      {check && (
        <>
          <p className={check.nomOk ? 'font-semibold text-secondary' : 'font-semibold text-destructive'}>
            {check.nomOk
              ? `Bénéficiaire conforme : ${check.beneficiaire ?? ''}`
              : 'Bénéficiaire non vérifié automatiquement'}
          </p>
          <p className="text-muted-foreground">
            Lu sur le reçu : {check.montant != null ? formatFcfa(check.montant) : 'montant illisible'} · ID{' '}
            {check.reference ?? 'illisible'}
            {check.date ? ` · ${check.date}` : ''}
          </p>
          {check.alertes.length > 0 && (
            <ul className="list-disc pl-5 text-destructive">
              {check.alertes.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
        </>
      )}
      {hasReceipt &&
        (image ? (
          <img src={image} alt="Reçu envoyé par l’élève" className="max-h-96 rounded-lg border border-border" />
        ) : (
          <Button
            variant="outline"
            className="min-h-11"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              setError('')
              try {
                const res = await getReceiptImage({ data: { id: paymentId } })
                if (res.image) setImage(res.image)
                else setError('Capture introuvable.')
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Chargement impossible.')
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? 'Chargement…' : 'Voir le reçu'}
          </Button>
        ))}
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </div>
  )
}
