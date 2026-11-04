import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  ClipboardList,
  Download,
  FileText,
  Flag,
  Gift,
  Lightbulb,
  Loader2,
  Power,
  ScrollText,
  ShieldAlert,
  Sparkles,
  Timer,
  Users,
} from 'lucide-react'
import {
  changeAccess,
  deleteLesson,
  exportCsv,
  generateWeeklyReport,
  getAdminStats,
  getAnnouncementAdmin,
  getClassStats,
  getFullAudit,
  getLessonAdmin,
  getSentinel,
  getSubjectAdmin,
  getSwitches,
  listFreeGrants,
  listIdeasAdmin,
  listLessonsAdmin,
  listQuizzesAdmin,
  listReports,
  listSubscriptions,
  listWeeklyReports,
  resetQuiz,
  resolveReport,
  searchSubjects,
  setAnnouncement,
  setFreeGrant,
  setIdeaStatus,
  setSubjectArchived,
  setSwitch,
} from '@/lib/admin.functions'
import { findStudents } from '@/lib/billing.functions'
import {
  ADMIN_FREE_MINUTES_PER_DAY,
  FREE_MINUTES_PER_DAY,
  OFFERS,
} from '@/lib/config'

const MODULES = [
  { id: 'tableau', label: 'Tableau de bord', icon: BarChart3 },
  { id: 'abonnements', label: 'Abonnements', icon: Users },
  { id: 'deblocages', label: 'Déblocages manuels', icon: Gift },
  { id: 'forfait40', label: 'Forfait gratuit 40 min', icon: Timer },
  { id: 'sujets', label: 'Sujets', icon: FileText },
  { id: 'lecons', label: 'Leçons', icon: BookOpen },
  { id: 'quiz', label: 'Quiz du jour', icon: ClipboardList },
  { id: 'annonce', label: 'Annonce globale', icon: Bell },
  { id: 'interrupteurs', label: 'Interrupteurs d’urgence', icon: Power },
  { id: 'exports', label: 'Exports CSV', icon: Download },
  { id: 'signalements', label: 'Signalements', icon: Flag },
  { id: 'idees', label: 'Boîte à idées', icon: Lightbulb },
  { id: 'sentinelle', label: 'Sentinelle', icon: ShieldAlert },
  { id: 'analyste', label: 'Bilan de l’Analyste', icon: Sparkles },
  { id: 'classes', label: 'Statistiques par classe', icon: Activity },
  { id: 'audit', label: 'Journal d’audit', icon: ScrollText },
] as const
type ModuleId = (typeof MODULES)[number]['id']

const errorText = (e: unknown) =>
  e instanceof Error && e.message
    ? e.message
    : 'Une erreur est survenue. Réessaie.'
const date = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'UTC',
  })
const fcfa = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`

/** Charge des données admin à l'ouverture d'un module, avec rechargement après action. */
function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const key = JSON.stringify(deps)
  const [tick, setTick] = useState(0)
  const [state, setState] = useState<{
    for: string
    data: T | null
    error: string | null
  }>({
    for: '',
    data: null,
    error: null,
  })
  const current = `${key}|${tick}`
  useEffect(() => {
    let alive = true
    load().then(
      (data) => alive && setState({ for: current, data, error: null }),
      (e) =>
        alive &&
        setState((s) => ({ for: current, data: s.data, error: errorText(e) })),
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current])
  const reload = useCallback(() => setTick((t) => t + 1), [])
  return {
    data: state.data,
    error: state.error,
    loading: state.for !== current,
    reload,
  }
}

/** Exécute une action admin et affiche son erreur éventuelle. */
function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (fn: () => Promise<unknown>, after?: () => unknown) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      await after?.()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, run }
}

const btn =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-50'
const btnPrimary = `${btn} bg-primary text-primary-foreground`
const btnGhost = `${btn} border border-border`
const input =
  'min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm'

function State({
  loading,
  error,
  children,
}: {
  loading: boolean
  error: string | null
  children: ReactNode
}) {
  if (error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    )
  if (loading)
    return (
      <p
        role="status"
        className="flex items-center gap-2 text-sm text-muted-foreground"
      >
        <Loader2
          className="size-4 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />{' '}
        Chargement…
      </p>
    )
  return <>{children}</>
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
      {children}
    </p>
  )
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-extrabold">{value}</p>
    </div>
  )
}

function ActionError({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-sm text-destructive">
      {error}
    </p>
  ) : null
}

export function AdminModules() {
  const [active, setActive] = useState<ModuleId>('tableau')
  const current = MODULES.find((m) => m.id === active)!
  return (
    <section
      className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6"
      aria-labelledby="modules-title"
    >
      <div>
        <h2 id="modules-title" className="font-display text-2xl font-bold">
          Modules de gestion
        </h2>
        <p className="text-sm text-muted-foreground">
          16 outils, tous alimentés par les données réelles de la base.
        </p>
      </div>
      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
        role="tablist"
        aria-label="Modules admin"
      >
        {MODULES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={active === m.id}
            onClick={() => setActive(m.id)}
            className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors ${
              active === m.id
                ? 'border-primary bg-primary/10'
                : 'border-border hover:bg-muted/50'
            }`}
          >
            <m.icon className="size-4 shrink-0" aria-hidden="true" />
            {m.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        aria-label={current.label}
        className="rounded-2xl border border-border p-4 sm:p-5"
      >
        <h3 className="mb-4 font-display text-xl font-bold">{current.label}</h3>
        {active === 'tableau' && <Dashboard />}
        {active === 'abonnements' && <Subscriptions />}
        {active === 'deblocages' && <Unlocks />}
        {active === 'forfait40' && <FreeGrants />}
        {active === 'sujets' && <Subjects />}
        {active === 'lecons' && <Lessons />}
        {active === 'quiz' && <Quizzes />}
        {active === 'annonce' && <AnnouncementModule />}
        {active === 'interrupteurs' && <Switches />}
        {active === 'exports' && <Exports />}
        {active === 'signalements' && <Reports />}
        {active === 'idees' && <Ideas />}
        {active === 'sentinelle' && <Sentinel />}
        {active === 'analyste' && <Analyst />}
        {active === 'classes' && <ClassStats />}
        {active === 'audit' && <Audit />}
      </div>
    </section>
  )
}

function Dashboard() {
  const { data, loading, error } = useLoad(() => getAdminStats())
  return (
    <State loading={loading} error={error}>
      {data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Élèves inscrits" value={data.inscrits} />
          <Stat label="Nouveaux (7 j)" value={data.nouveaux7} />
          <Stat label="Actifs aujourd’hui" value={data.actifsJour} />
          <Stat label="Actifs (7 j)" value={data.actifsSemaine} />
          <Stat label="Abonnés actifs" value={data.abonnes} />
          <Stat label="Expirent sous 7 j" value={data.expirent7} />
          <Stat label="En essai gratuit" value={data.enEssai} />
          <Stat label="Au forfait gratuit (essai fini, non payé)" value={data.bloques} />
          <Stat label="Forfaits 40 min/jour actifs" value={data.forfaits40} />
          <Stat label="Revenus du mois" value={fcfa(data.revenusMois)} />
          <Stat label="Revenus totaux" value={fcfa(data.revenusTotal)} />
          <Stat label="Paiements en attente" value={data.paiementsAttente} />
          <Stat label="Sujets en ligne" value={data.sujetsActifs} />
          <Stat label="Leçons rédigées" value={data.lecons} />
          <Stat label="Signalements ouverts" value={data.signalements} />
        </div>
      )}
    </State>
  )
}

function Subscriptions() {
  const [filtre, setFiltre] = useState<'actifs' | 'expirent' | 'expires'>(
    'actifs',
  )
  const { data, loading, error, reload } = useLoad(
    () => listSubscriptions({ data: { filtre } }),
    [filtre],
  )
  const action = useAction()
  const act = (userId: string, kind: 'prolonger' | 'revoquer') => {
    const reason = window.prompt(
      kind === 'prolonger'
        ? 'Motif de la prolongation de 7 jours :'
        : 'Motif de la révocation :',
    )
    if (!reason || reason.trim().length < 3) return
    void action.run(
      () =>
        changeAccess({
          data: {
            userId,
            action: kind === 'prolonger' ? 'offrir' : 'revoquer',
            days: 7,
            reason,
          },
        }),
      reload,
    )
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['actifs', 'Actifs'],
            ['expirent', 'Expirent sous 7 jours'],
            ['expires', 'Expirés'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFiltre(id)}
            className={filtre === id ? btnPrimary : btnGhost}
          >
            {label}
          </button>
        ))}
      </div>
      <ActionError error={action.error} />
      <State loading={loading} error={error}>
        {data?.length ? (
          <ul className="divide-y divide-border">
            {data.map((s) => (
              <li
                key={s.userId}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div>
                  <p className="font-semibold">
                    {s.firstName} · {s.classe}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {OFFERS.find((o) => o.id === s.offerId)?.label ??
                      'Accès offert'}{' '}
                    · jusqu’au {date(s.expiresAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={action.busy}
                    className={btnGhost}
                    onClick={() => act(s.userId, 'prolonger')}
                  >
                    +7 jours
                  </button>
                  {filtre !== 'expires' && (
                    <button
                      type="button"
                      disabled={action.busy}
                      className={btnGhost}
                      onClick={() => act(s.userId, 'revoquer')}
                    >
                      Révoquer
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Aucun abonnement dans cette liste.</Empty>
        )}
      </State>
    </div>
  )
}

function Unlocks() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<
    Awaited<ReturnType<typeof findStudents>>
  >([])
  const [selected, setSelected] = useState<string | null>(null)
  const [days, setDays] = useState(7)
  const [reason, setReason] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const action = useAction()
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Offre un accès Premium à un élève (concours, geste commercial, souci de
        paiement). Chaque déblocage est noté dans le journal d’audit.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (query.trim().length < 2) return
          void action.run(async () =>
            setResults(await findStudents({ data: { query } })),
          )
        }}
      >
        <label className="sr-only" htmlFor="unlock-search">
          Prénom ou identifiant
        </label>
        <input
          id="unlock-search"
          className={input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Prénom ou identifiant de l’élève"
        />
        <button className={btnGhost} disabled={action.busy}>
          Chercher
        </button>
      </form>
      {results.length > 0 && (
        <ul className="space-y-2">
          {results.map((r) => (
            <li key={r.userId}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border px-3">
                <input
                  type="radio"
                  name="unlock-student"
                  checked={selected === r.userId}
                  onChange={() => setSelected(r.userId)}
                />
                <span>
                  {r.firstName} · {r.classe} {r.serie}
                  {r.expiresAt && (
                    <span className="text-muted-foreground">
                      {' '}
                      · Premium jusqu’au {date(r.expiresAt)}
                    </span>
                  )}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <form
          className="grid gap-3 sm:grid-cols-[8rem_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault()
            setDone(null)
            void action.run(
              () =>
                changeAccess({
                  data: { userId: selected, action: 'offrir', days, reason },
                }),
              () => setDone(`${days} jour(s) d’accès Premium offerts.`),
            )
          }}
        >
          <label className="text-sm">
            Jours
            <input
              type="number"
              min={1}
              max={366}
              className={input}
              value={days}
              onChange={(e) => setDays(Number(e.target.value) || 1)}
            />
          </label>
          <label className="text-sm">
            Motif
            <input
              className={input}
              required
              minLength={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button className={`${btnPrimary} self-end`} disabled={action.busy}>
            Offrir l’accès
          </button>
        </form>
      )}
      <ActionError error={action.error} />
      {done && (
        <p role="status" className="text-sm font-semibold text-secondary">
          {done}
        </p>
      )}
    </div>
  )
}

function FreeGrants() {
  const grants = useLoad(() => listFreeGrants())
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<
    Awaited<ReturnType<typeof findStudents>>
  >([])
  const [selected, setSelected] = useState<string | null>(null)
  const [days, setDays] = useState(0)
  const [note, setNote] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const action = useAction()
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Sans abonnement, chaque élève a {FREE_MINUTES_PER_DAY} min/jour avec des
        fonctions limitées. Le forfait de {ADMIN_FREE_MINUTES_PER_DAY} min/jour
        ne s’active que d’ici, élève par élève. Chaque décision est notée dans
        le journal d’audit.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (query.trim().length < 2) return
          void action.run(async () =>
            setResults(await findStudents({ data: { query } })),
          )
        }}
      >
        <label className="sr-only" htmlFor="grant-search">
          Prénom ou identifiant
        </label>
        <input
          id="grant-search"
          className={input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Prénom ou identifiant de l’élève"
        />
        <button className={btnGhost} disabled={action.busy}>
          Chercher
        </button>
      </form>
      {results.length > 0 && (
        <ul className="space-y-2">
          {results.map((r) => (
            <li key={r.userId}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border px-3">
                <input
                  type="radio"
                  name="grant-student"
                  checked={selected === r.userId}
                  onChange={() => setSelected(r.userId)}
                />
                <span>
                  {r.firstName} · {r.classe} {r.serie}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <form
          className="grid gap-3 sm:grid-cols-[10rem_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault()
            setDone(null)
            void action.run(
              () =>
                setFreeGrant({
                  data: { userId: selected, action: 'activer', days, note },
                }),
              () => {
                setDone(
                  `Forfait ${ADMIN_FREE_MINUTES_PER_DAY} min/jour activé ${days ? `pour ${days} jour(s)` : 'sans date de fin'}.`,
                )
                grants.reload()
              },
            )
          }}
        >
          <label className="text-sm">
            Durée (jours, 0 = sans fin)
            <input
              type="number"
              min={0}
              max={366}
              className={input}
              value={days}
              onChange={(e) => setDays(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>
          <label className="text-sm">
            Motif
            <input
              className={input}
              required
              minLength={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <button className={`${btnPrimary} self-end`} disabled={action.busy}>
            Activer {ADMIN_FREE_MINUTES_PER_DAY} min/jour
          </button>
        </form>
      )}
      <ActionError error={action.error} />
      {done && (
        <p role="status" className="text-sm font-semibold text-secondary">
          {done}
        </p>
      )}
      <h4 className="pt-2 font-display text-lg font-bold">Forfaits actifs</h4>
      <State loading={grants.loading} error={grants.error}>
        {((list) =>
          list.length === 0 ? (
            <Empty>Aucun forfait {ADMIN_FREE_MINUTES_PER_DAY} min actif.</Empty>
          ) : (
            <ul className="space-y-2">
              {list.map((g) => (
                <li
                  key={g.userId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3 text-sm"
                >
                  <span>
                    <strong>{g.firstName}</strong> · {g.classe} ·{' '}
                    {g.expiresAt ? `jusqu’au ${date(g.expiresAt)}` : 'sans date de fin'}{' '}
                    · {g.minutesAujourdhui} min utilisées aujourd’hui
                    {g.note && (
                      <span className="block text-muted-foreground">{g.note}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    className={btnGhost}
                    disabled={action.busy}
                    onClick={() =>
                      void action.run(
                        () =>
                          setFreeGrant({
                            data: {
                              userId: g.userId,
                              action: 'retirer',
                              note: 'Retrait par l’administrateur',
                            },
                          }),
                        grants.reload,
                      )
                    }
                  >
                    Retirer
                  </button>
                </li>
              ))}
            </ul>
          ))(grants.data ?? [])}
      </State>
    </div>
  )
}

function Subjects() {
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [archives, setArchives] = useState(false)
  const { data, loading, error, reload } = useLoad(
    () => searchSubjects({ data: { q: search, archives } }),
    [search, archives],
  )
  const [open, setOpen] = useState<Awaited<
    ReturnType<typeof getSubjectAdmin>
  > | null>(null)
  const action = useAction()
  return (
    <div className="space-y-3">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setSearch(q)
        }}
      >
        <label className="sr-only" htmlFor="subj-q">
          Rechercher un sujet
        </label>
        <input
          id="subj-q"
          className={`${input} flex-1`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Titre, chapitre, matière ou identifiant"
        />
        <button className={btnGhost}>Chercher</button>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={archives}
            onChange={(e) => setArchives(e.target.checked)}
          />{' '}
          Inclure les archivés
        </label>
      </form>
      <ActionError error={action.error} />
      <State loading={loading} error={error}>
        {data?.length ? (
          <ul className="divide-y divide-border">
            {data.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold">
                    {s.titre}
                    {s.signalements > 0 && (
                      <span className="ml-2 rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive">
                        {s.signalements} signalement
                        {s.signalements > 1 ? 's' : ''}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {s.classe} · {s.matiere} · niveau {s.niveau} ·{' '}
                    {date(s.createdAt)}
                    {s.archivedAt && ' · archivé'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={btnGhost}
                    disabled={action.busy}
                    onClick={() =>
                      void action.run(async () =>
                        setOpen(await getSubjectAdmin({ data: { id: s.id } })),
                      )
                    }
                  >
                    Voir
                  </button>
                  <button
                    type="button"
                    className={btnGhost}
                    disabled={action.busy}
                    onClick={() =>
                      void action.run(
                        () =>
                          setSubjectArchived({
                            data: { id: s.id, archived: !s.archivedAt },
                          }),
                        reload,
                      )
                    }
                  >
                    {s.archivedAt ? 'Réactiver' : 'Archiver'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Aucun sujet trouvé.</Empty>
        )}
      </State>
      {open && (
        <article className="space-y-3 rounded-2xl border border-border bg-background p-4">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-display text-lg font-bold">{open.titre}</h4>
            <button
              type="button"
              className={btnGhost}
              onClick={() => setOpen(null)}
            >
              Fermer
            </button>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-sm">
            {open.enonce}
          </pre>
          <p className="text-sm">
            <strong>Barème :</strong> {open.bareme}
          </p>
          <details>
            <summary className="cursor-pointer text-sm font-semibold">
              Corrigé (réservé à l’admin)
            </summary>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm">
              {open.corrige ?? 'Pas de corrigé enregistré.'}
            </pre>
          </details>
          {open.reports.length > 0 && (
            <ul className="list-disc pl-5 text-sm">
              {open.reports.map((r, i) => (
                <li key={i}>{r.reason}</li>
              ))}
            </ul>
          )}
        </article>
      )}
    </div>
  )
}

function Lessons() {
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const { data, loading, error, reload } = useLoad(
    () => listLessonsAdmin({ data: { q: search } }),
    [search],
  )
  const [open, setOpen] = useState<{ titre: string; texte: string } | null>(
    null,
  )
  const action = useAction()
  const statut: Record<string, string> = {
    ready: 'prête',
    pending: 'en attente',
    preparing: 'en rédaction',
    failed: 'échec',
  }
  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setSearch(q)
        }}
      >
        <label className="sr-only" htmlFor="lesson-q">
          Rechercher une leçon
        </label>
        <input
          id="lesson-q"
          className={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Chapitre ou matière"
        />
        <button className={btnGhost}>Chercher</button>
      </form>
      <ActionError error={action.error} />
      <State loading={loading} error={error}>
        {data?.length ? (
          <ul className="divide-y divide-border">
            {data.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div>
                  <p className="font-semibold">{l.titre ?? l.chapitre}</p>
                  <p className="text-sm text-muted-foreground">
                    {l.classe} · {l.matiere} · {statut[l.status] ?? l.status} ·{' '}
                    {l.eleves} élève{l.eleves > 1 ? 's' : ''} en révision
                    {l.error && ` · ${l.error}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  {l.status === 'ready' && (
                    <button
                      type="button"
                      className={btnGhost}
                      disabled={action.busy}
                      onClick={() =>
                        void action.run(async () =>
                          setOpen(await getLessonAdmin({ data: { id: l.id } })),
                        )
                      }
                    >
                      Relire
                    </button>
                  )}
                  <button
                    type="button"
                    className={btnGhost}
                    disabled={action.busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          'Supprimer cette leçon ? Elle sera rédigée à nouveau à la prochaine demande.',
                        )
                      )
                        void action.run(
                          () => deleteLesson({ data: { id: l.id } }),
                          reload,
                        )
                    }}
                  >
                    Faire réécrire
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Aucune leçon rédigée pour l’instant.</Empty>
        )}
      </State>
      {open && (
        <article className="space-y-2 rounded-2xl border border-border bg-background p-4">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-display text-lg font-bold">{open.titre}</h4>
            <button
              type="button"
              className={btnGhost}
              onClick={() => setOpen(null)}
            >
              Fermer
            </button>
          </div>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap font-sans text-sm">
            {open.texte}
          </pre>
        </article>
      )}
    </div>
  )
}

function Quizzes() {
  const { data, loading, error, reload } = useLoad(() => listQuizzesAdmin())
  const action = useAction()
  const statut: Record<string, string> = {
    ready: 'prêt',
    pending: 'en attente',
    preparing: 'en préparation',
    failed: 'échec',
  }
  return (
    <State loading={loading} error={error}>
      <ActionError error={action.error} />
      {data && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Quiz du {data.day}</p>
          {data.quizzes.length ? (
            <ul className="divide-y divide-border">
              {data.quizzes.map((q) => (
                <li
                  key={q.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <div>
                    <p className="font-semibold">{q.classe}</p>
                    <p className="text-sm text-muted-foreground">
                      {statut[q.status] ?? q.status} · {q.rendus}/{q.tentatives}{' '}
                      rendus
                      {q.rendus > 0 && ` · moyenne ${q.moyenne}/${q.total}`}
                    </p>
                  </div>
                  {q.tentatives === 0 && (
                    <button
                      type="button"
                      className={btnGhost}
                      disabled={action.busy}
                      onClick={() =>
                        void action.run(
                          () => resetQuiz({ data: { id: q.id } }),
                          reload,
                        )
                      }
                    >
                      Régénérer
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Aucun quiz préparé aujourd’hui pour l’instant.</Empty>
          )}
        </div>
      )}
    </State>
  )
}

function AnnouncementModule() {
  const { data, loading, error, reload } = useLoad(() => getAnnouncementAdmin())
  const [message, setMessage] = useState('')
  const [niveau, setNiveau] = useState<'info' | 'alerte'>('info')
  const [jours, setJours] = useState(3)
  const action = useAction()
  return (
    <div className="space-y-4">
      <State loading={loading} error={error}>
        {data ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3">
            <p className="text-sm">
              <strong>En ligne :</strong> {data.message}
              {data.fin && (
                <span className="text-muted-foreground">
                  {' '}
                  · jusqu’au {date(data.fin)}
                </span>
              )}
            </p>
            <button
              type="button"
              className={btnGhost}
              disabled={action.busy}
              onClick={() =>
                void action.run(
                  () =>
                    setAnnouncement({
                      data: { message: '', niveau: 'info', jours: 0 },
                    }),
                  reload,
                )
              }
            >
              Retirer
            </button>
          </div>
        ) : (
          <Empty>Aucune annonce affichée.</Empty>
        )}
      </State>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          void action.run(
            () => setAnnouncement({ data: { message, niveau, jours } }),
            () => {
              setMessage('')
              reload()
            },
          )
        }}
      >
        <label className="block text-sm">
          Message affiché en haut de l’espace élève (280 caractères)
          <textarea
            className={`${input} min-h-24 py-2`}
            maxLength={280}
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <label className="text-sm">
            Type
            <select
              className={input}
              value={niveau}
              onChange={(e) => setNiveau(e.target.value as 'info' | 'alerte')}
            >
              <option value="info">Information</option>
              <option value="alerte">Alerte</option>
            </select>
          </label>
          <label className="text-sm">
            Durée (jours, 0 = sans fin)
            <input
              type="number"
              min={0}
              max={60}
              className={input}
              value={jours}
              onChange={(e) => setJours(Number(e.target.value) || 0)}
            />
          </label>
        </div>
        <button className={btnPrimary} disabled={action.busy}>
          Publier l’annonce
        </button>
        <ActionError error={action.error} />
      </form>
    </div>
  )
}

function Switches() {
  const { data, loading, error, reload } = useLoad(() => getSwitches())
  const action = useAction()
  return (
    <State loading={loading} error={error}>
      <p className="mb-3 text-sm text-muted-foreground">
        À utiliser en cas d’abus ou de dépassement de crédits. L’effet est
        immédiat pour tous les élèves.
      </p>
      <ActionError error={action.error} />
      <ul className="space-y-2">
        {data?.map((s) => (
          <li
            key={s.key}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"
          >
            <div>
              <p className="font-semibold">{s.label}</p>
              <p
                className={`text-sm ${s.on ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}
              >
                {s.on ? 'Coupé' : 'En service'}
              </p>
            </div>
            <button
              type="button"
              className={s.on ? btnPrimary : btnGhost}
              disabled={action.busy}
              aria-pressed={s.on}
              onClick={() =>
                void action.run(
                  () =>
                    setSwitch({
                      data: {
                        key: s.key as Parameters<
                          typeof setSwitch
                        >[0]['data']['key'],
                        on: !s.on,
                      },
                    }),
                  reload,
                )
              }
            >
              {s.on ? 'Rétablir' : 'Couper'}
            </button>
          </li>
        ))}
      </ul>
    </State>
  )
}

function Exports() {
  const action = useAction()
  const download = (type: 'eleves' | 'paiements' | 'abonnements') =>
    void action.run(async () => {
      const { filename, csv } = await exportCsv({ data: { type } })
      const url = URL.createObjectURL(
        new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }),
      )
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    })
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Fichiers CSV (séparateur « ; ») lisibles dans Excel ou Google Sheets.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={btnGhost}
          disabled={action.busy}
          onClick={() => download('eleves')}
        >
          <Download className="size-4" aria-hidden="true" /> Élèves
        </button>
        <button
          type="button"
          className={btnGhost}
          disabled={action.busy}
          onClick={() => download('paiements')}
        >
          <Download className="size-4" aria-hidden="true" /> Paiements
        </button>
        <button
          type="button"
          className={btnGhost}
          disabled={action.busy}
          onClick={() => download('abonnements')}
        >
          <Download className="size-4" aria-hidden="true" /> Abonnements
        </button>
      </div>
      <ActionError error={action.error} />
    </div>
  )
}

function Reports() {
  const { data, loading, error, reload } = useLoad(() => listReports())
  const action = useAction()
  return (
    <State loading={loading} error={error}>
      <ActionError error={action.error} />
      {data && (
        <div className="space-y-5">
          <div>
            <h4 className="mb-2 font-semibold">
              Erreurs de sujets ({data.sujets.length})
            </h4>
            {data.sujets.length ? (
              <ul className="divide-y divide-border">
                {data.sujets.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <div>
                      <p className="font-semibold">{r.titre}</p>
                      <p className="text-sm text-muted-foreground">
                        {r.classe} · {r.firstName} · {date(r.createdAt)}
                      </p>
                      <p className="text-sm">« {r.reason} »</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={btnGhost}
                        disabled={action.busy}
                        onClick={() =>
                          void action.run(
                            () =>
                              setSubjectArchived({
                                data: { id: r.subjectId, archived: true },
                              }),
                            reload,
                          )
                        }
                      >
                        Archiver le sujet
                      </button>
                      <button
                        type="button"
                        className={btnGhost}
                        disabled={action.busy}
                        onClick={() =>
                          void action.run(
                            () => resolveReport({ data: { id: r.id } }),
                            reload,
                          )
                        }
                      >
                        Classer
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Aucun signalement de sujet en attente.</Empty>
            )}
          </div>
          <div>
            <h4 className="mb-2 font-semibold">Réponses de l’IA signalées</h4>
            {data.ia.length ? (
              <ul className="divide-y divide-border">
                {data.ia.map((r) => (
                  <li key={r.id} className="py-3 text-sm">
                    <p className="text-muted-foreground">
                      {r.kind} · {r.firstName} · {date(r.createdAt)}
                    </p>
                    {r.question && <p>Question : {r.question}</p>}
                    <p>Réponse : {r.answer}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Aucune réponse de l’IA signalée.</Empty>
            )}
          </div>
        </div>
      )}
    </State>
  )
}

function Ideas() {
  const { data, loading, error, reload } = useLoad(() => listIdeasAdmin())
  const action = useAction()
  const labels = {
    nouvelle: 'Nouvelle',
    retenue: 'Retenue',
    realisee: 'Réalisée',
    refusee: 'Refusée',
  } as const
  return (
    <State loading={loading} error={error}>
      <ActionError error={action.error} />
      {data?.length ? (
        <ul className="divide-y divide-border">
          {data.map((i) => (
            <li
              key={i.id}
              className="flex flex-wrap items-center justify-between gap-2 py-3"
            >
              <div className="min-w-0 flex-1">
                <p>{i.texte}</p>
                <p className="text-sm text-muted-foreground">
                  {i.votes} vote{i.votes > 1 ? 's' : ''} · {i.auteur} ·{' '}
                  {date(i.createdAt)}
                </p>
              </div>
              <label className="text-sm">
                <span className="sr-only">Statut</span>
                <select
                  className={input}
                  value={i.status}
                  disabled={action.busy}
                  onChange={(e) =>
                    void action.run(
                      () =>
                        setIdeaStatus({
                          data: {
                            id: i.id,
                            status: e.target.value as keyof typeof labels,
                          },
                        }),
                      reload,
                    )
                  }
                >
                  {Object.entries(labels).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Aucune idée proposée par les élèves pour l’instant.</Empty>
      )}
    </State>
  )
}

function Sentinel() {
  const { data, loading, error, reload } = useLoad(() => getSentinel())
  const color = {
    haute: 'border-destructive bg-destructive/10',
    moyenne: 'border-primary bg-primary/10',
    basse: 'border-border',
  }
  return (
    <State loading={loading} error={error}>
      {data && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Analyse du {date(data.verifieLe)}
            </p>
            <button type="button" className={btnGhost} onClick={reload}>
              Relancer l’analyse
            </button>
          </div>
          {data.alertes.length ? (
            <ul className="space-y-2">
              {data.alertes.map((a, i) => (
                <li
                  key={i}
                  className={`rounded-xl border p-3 ${color[a.gravite]}`}
                >
                  <p className="font-semibold">
                    {a.gravite === 'haute'
                      ? 'Gravité haute'
                      : a.gravite === 'moyenne'
                        ? 'Gravité moyenne'
                        : 'Gravité basse'}{' '}
                    · {a.titre}
                  </p>
                  <p className="text-sm">{a.detail}</p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>
              Aucun signal suspect détecté : paiements, montants, rafales et
              erreurs sont normaux.
            </Empty>
          )}
        </div>
      )}
    </State>
  )
}

function Analyst() {
  const { data, loading, error, reload } = useLoad(() => listWeeklyReports())
  const action = useAction()
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        L’Analyste (Claude Sonnet) rédige un bilan à partir des chiffres réels
        des 7 derniers jours. Il ne peut pas inventer de chiffres.
      </p>
      <button
        type="button"
        className={btnPrimary}
        disabled={action.busy}
        onClick={() => void action.run(() => generateWeeklyReport(), reload)}
      >
        {action.busy ? (
          <Loader2
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : (
          <Sparkles className="size-4" aria-hidden="true" />
        )}
        Rédiger le bilan de la semaine
      </button>
      <ActionError error={action.error} />
      <State loading={loading} error={error}>
        {data?.bilans.length ? (
          <div className="space-y-3">
            {data.bilans.map((b) => (
              <article
                key={b.week}
                className="rounded-xl border border-border p-4"
              >
                <p className="text-sm font-semibold">Semaine du {b.week}</p>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-sm">
                  {b.content}
                </pre>
              </article>
            ))}
          </div>
        ) : (
          <Empty>Aucun bilan rédigé pour l’instant.</Empty>
        )}
      </State>
    </div>
  )
}

function ClassStats() {
  const { data, loading, error } = useLoad(() => getClassStats())
  return (
    <State loading={loading} error={error}>
      {data?.length ? (
        <div className="space-y-3">
          {data.map((c) => (
            <details
              key={c.classe}
              className="rounded-xl border border-border p-3"
            >
              <summary className="cursor-pointer">
                <span className="font-semibold">{c.classe}</span>
                <span className="text-sm text-muted-foreground">
                  {' '}
                  · {c.eleves} élève{c.eleves > 1 ? 's' : ''} · {c.abonnes}{' '}
                  abonné{c.abonnes > 1 ? 's' : ''} · {c.quizRendus} quiz rendus
                  (30 j){c.quizRendus > 0 && ` · moyenne ${c.moyenneQuiz}/10`}
                </span>
              </summary>
              {c.parMatiere.length ? (
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-1">Matière</th>
                      <th className="py-1">Sujets en ligne</th>
                      <th className="py-1">Leçons</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.parMatiere.map((m) => (
                      <tr key={m.matiere} className="border-t border-border">
                        <td className="py-1">{m.matiere}</td>
                        <td className="py-1">{m.sujets}</td>
                        <td className="py-1">{m.lecons}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Aucun sujet généré pour cette classe.
                </p>
              )}
            </details>
          ))}
        </div>
      ) : (
        <Empty>Aucun élève inscrit pour l’instant.</Empty>
      )}
    </State>
  )
}

function Audit() {
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const { data, loading, error } = useLoad(
    () => getFullAudit({ data: { q: search, page } }),
    [search, page],
  )
  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setPage(0)
          setSearch(q)
        }}
      >
        <label className="sr-only" htmlFor="audit-q">
          Filtrer le journal
        </label>
        <input
          id="audit-q"
          className={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Action, élève, sujet…"
        />
        <button className={btnGhost}>Filtrer</button>
      </form>
      <State loading={loading} error={error}>
        {data?.entries.length ? (
          <ul className="divide-y divide-border text-sm">
            {data.entries.map((e, i) => (
              <li key={i} className="py-2">
                <span className="font-semibold">{e.action}</span>
                <span className="text-muted-foreground">
                  {' '}
                  · {e.source} · {date(e.createdAt)}
                </span>
                {(e.target || e.details) && (
                  <p className="text-muted-foreground">
                    {[e.target, e.details].filter(Boolean).join(' · ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Aucune entrée dans le journal.</Empty>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            className={btnGhost}
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Plus récents
          </button>
          <button
            type="button"
            className={btnGhost}
            disabled={!data?.hasNext}
            onClick={() => setPage((p) => p + 1)}
          >
            Plus anciens
          </button>
        </div>
      </State>
    </div>
  )
}
