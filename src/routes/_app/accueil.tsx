import { ShareSite } from '@/components/app/share-site'
import { useStudent } from '@/hooks/use-student'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, BookOpen, Flame, Loader2, Mic, RefreshCw, Sparkles, Timer, Trophy } from 'lucide-react'
import { ExempleBadge, LevelPill } from '@/components/app/brand'
import { useNow } from '@/hooks/use-now'
import { getClassSujets } from '@/lib/sujets.functions'
import { PreparingNotice } from '@/components/app/preparing-notice'
import { LEVELS, formatDuration, msUntilNextRefresh } from '@/lib/config'
import { getDailyQuiz } from '@/lib/quiz.functions'
import { InstallAppCard } from '@/components/app/pwa'

export const Route = createFileRoute('/_app/accueil')({
  loader: async ({ context }) => {
    const niveau = context.account.profile.niveauPrefere
    const quizP = getDailyQuiz().catch(() => null)
    const preferred = await getClassSujets({ data: { niveau, limit: 3 } })
    const sujets =
      preferred.sujets.length > 0 ? preferred : await getClassSujets({ data: { limit: 3 } })
    return { ...sujets, quiz: await quizP }
  },
  head: () => ({
    meta: [
      { title: 'Accueil — Annales+' },
      {
        name: 'description',
        content:
          'Ton tableau de révision personnalisé : sujets de ta classe, leçons et rappel de ta dernière séance.',
      },
      { property: 'og:title', content: 'Accueil — Annales+' },
      {
        property: 'og:description',
        content: 'Ton tableau de révision personnalisé.',
      },
    ],
  }),
  component: Accueil,
})

function Accueil() {
  const s = useStudent()
  const now = useNow(30_000)
  const data = Route.useLoaderData()
  const recommended = data.sujets.slice(0, 3)
  const matieres = data.matieres
  const niveau = LEVELS[s.niveauPrefere - 1]

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">
            {s.pays}
          </p>
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
            Bonjour {s.firstName},{' '}
            <span className="text-primary">
              {s.classe} {s.serie}
            </span>
          </h1>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold">
          <RefreshCw className="size-4 text-secondary" aria-hidden="true" />
          Nouveaux sujets dans{' '}
          {now ? formatDuration(msUntilNextRefresh(now)) : '…'}
        </span>
      </section>

      {data.quiz && <QuizCard quiz={data.quiz} />}

      <InstallAppCard />

      <section
        aria-label="Accès rapides"
        className="grid grid-cols-2 gap-3 md:grid-cols-4"
      >
        <QuickLink
          to="/explorer"
          icon={<Timer className="size-5" />}
          label="Faire un sujet"
        />
        <QuickLink
          to="/lecons"
          icon={<BookOpen className="size-5" />}
          label="Apprendre une leçon"
        />
        <QuickLink
          to="/ia"
          icon={<Sparkles className="size-5" />}
          label="Demander au tuteur"
        />
        <QuickLink
          to="/oral"
          icon={<Mic className="size-5" />}
          label="S’entraîner à l’oral"
        />
      </section>

      <section aria-labelledby="pour-toi">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="pour-toi" className="text-2xl">
              Sujets pour toi
            </h2>
            <p className="text-sm text-muted-foreground">
              Ton niveau préféré : {niveau.label} · {s.classe} {s.serie}
            </p>
          </div>
          <Link
            to="/explorer"
            className="min-h-11 content-center text-sm font-semibold text-primary hover:underline"
          >
            Tout voir
          </Link>
        </div>
        <div className="mt-4">
          <PreparingNotice preparing={data.preparing} classe={s.classe} />
        </div>
        {recommended.length === 0 && !data.preparing && (
          <p className="mt-4 rounded-2xl border border-border p-5 text-muted-foreground">
            Aucun sujet ne correspond encore à ta classe et à ton niveau.{' '}
            <Link
              to="/ia"
              search={{ mode: 'Exercice similaire' }}
              className="font-semibold text-primary underline"
            >
              Demande un exercice de {s.classe} au tuteur IA
            </Link>
            .
          </p>
        )}
        <ul className="mt-4 grid gap-4 md:grid-cols-3">
          {recommended.map((x) => {
            const m = matieres.find((mm) => mm.id === x.matiere)
            return (
              <li key={x.id}>
                <Link
                  to="/sujets/$sujetId"
                  params={{ sujetId: x.id }}
                  className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md motion-reduce:transition-none"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-muted-foreground">
                      <span aria-hidden="true">{m?.emoji}</span> {m?.nom}
                    </span>
                    <ExempleBadge />
                  </div>
                  <h3 className="mt-3 text-lg leading-snug">{x.titre}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {x.chapitre}
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-4">
                    <LevelPill niveau={x.niveau} />
                    <span className="text-sm text-muted-foreground">
                      {x.dureeMin} min
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="matieres">
        <h2 id="matieres" className="text-2xl">
          Tes matières
        </h2>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {matieres.map((m) => (
            <li key={m.id}>
              <Link
                to="/explorer"
                search={{ matiere: m.id }}
                className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 font-semibold shadow-sm hover:border-primary"
              >
                <span aria-hidden="true" className="text-xl">
                  {m.emoji}
                </span>
                {m.nom}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <ShareSite />
    </div>
  )
}

function QuickLink({
  to,
  icon,
  label,
}: {
  to: '/explorer' | '/lecons' | '/ia' | '/oral'
  icon: React.ReactNode
  label: string
}) {
  return (
    <Link
      to={to}
      className="flex min-h-24 flex-col justify-between rounded-2xl border border-border bg-card p-4 font-semibold shadow-sm hover:border-primary"
    >
      <span
        className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary"
        aria-hidden="true"
      >
        {icon}
      </span>
      {label}
    </Link>
  )
}

function QuizCard({
  quiz,
}: {
  quiz: NonNullable<ReturnType<typeof Route.useLoaderData>['quiz']>
}) {
  const done = quiz.status === 'done'
  return (
    <Link
      to="/quiz"
      className="flex flex-col gap-4 rounded-2xl border-2 border-primary/50 bg-primary/10 p-5 shadow-sm transition-shadow hover:shadow-md motion-reduce:transition-none sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-4">
        <span
          className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"
          aria-hidden="true"
        >
          {done ? <Trophy className="size-6" /> : <Timer className="size-6" />}
        </span>
        <div>
          <h2 className="font-display text-xl font-extrabold">Quiz du jour</h2>
          <p className="text-sm text-muted-foreground">
            {done
              ? `Fait : ${quiz.score} / ${quiz.total}. Nouveau quiz demain à minuit.`
              : quiz.status === 'preparing'
                ? 'En préparation pour ta classe…'
                : quiz.status === 'unavailable'
                  ? 'Indisponible aujourd’hui, réessaie demain.'
                  : `${quiz.total} questions · ${quiz.secondsPerQuestion} s chacune · toutes tes matières`}
          </p>
          <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold">
            <Flame className="size-4 text-primary" aria-hidden="true" />
            {quiz.streak > 0
              ? `${quiz.streak} jour${quiz.streak > 1 ? 's' : ''} d’affilée`
              : 'Commence ta série aujourd’hui'}
          </p>
        </div>
      </div>
      <span className="inline-flex min-h-11 items-center gap-2 self-start rounded-full bg-ink px-5 font-bold text-ink-foreground sm:self-auto">
        {quiz.status === 'preparing' ? (
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : null}
        {done ? 'Voir la correction' : quiz.status === 'started' ? 'Reprendre' : 'Jouer'}
        <ArrowRight className="size-4" aria-hidden="true" />
      </span>
    </Link>
  )
}
