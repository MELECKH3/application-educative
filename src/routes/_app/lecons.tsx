import { useStudent } from '@/hooks/use-student'
import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  ArrowRight,
  BellRing,
  BookMarked,
  Check,
  Sigma,
  Lightbulb,
  ListChecks,
  Loader2,
  PencilLine,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react'
import { ExempleBadge } from '@/components/app/brand'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { speakText } from '@/lib/voice'
import { gradeLessonSummary, rephraseLessonStep } from '@/lib/ai.functions'
import { ExplainLesson } from '@/components/app/explain-lesson'
import { matiereById, matieresPour } from '@/lib/curriculum'
import {
  NIVEAU_QUESTION_LABEL,
  STEP_KEYS,
  STEP_TITLES,
  type ExempleResolu,
  type Formule,
  type LeconIA,
  type LessonStepKey,
  type MotCle,
  type Pratique,
  type TestQuestion,
  type Verification,
} from '@/lib/lecons'
import {
  getLesson,
  getLessonCatalog,
  getLessonTest,
  prepareNextLesson,
  requestLesson,
  submitLessonTest,
} from '@/lib/lecons.functions'

export const Route = createFileRoute('/_app/lecons')({
  validateSearch: (
    s: Record<string, unknown>,
  ): { matiere?: string; lecon?: string } => ({
    matiere:
      typeof s.matiere === 'string' && /^[a-z]{2,20}$/.test(s.matiere)
        ? s.matiere
        : undefined,
    lecon:
      typeof s.lecon === 'string' && /^[0-9a-f-]{36}$/.test(s.lecon)
        ? s.lecon
        : undefined,
  }),
  loaderDeps: ({ search }) => ({ matiere: search.matiere ?? '' }),
  loader: ({ deps }) => getLessonCatalog({ data: { matiere: deps.matiere } }),
  head: () => ({
    meta: [
      { title: 'Leçons — Annales+' },
      {
        name: 'description',
        content:
          'Des leçons rédigées en quelques secondes par le Professeur IA pour ta classe : objectifs, 4 temps, exercices guidés, puis un test de fin de leçon et des révisions programmées.',
      },
      { property: 'og:title', content: 'Leçons — Annales+' },
      {
        property: 'og:description',
        content: 'Apprends chaque chapitre de ta classe avec le Professeur IA.',
      },
    ],
  }),
  component: LeconsPage,
})

function speak(text: string) {
  speakText(text, { codes: ['fr-FR', 'fr-CA', 'fr'] })
}

function LeconsPage() {
  const s = useStudent()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/lecons' })
  const data = Route.useLoaderData()
  const matieres = matieresPour(s.classe, s.serie)
  const matiere = matiereById(data.matiere)
  const [chapitre, setChapitre] = useState('')
  const [asking, setAsking] = useState<string | null>(null)
  const [error, setError] = useState('')

  const open = (id: string) =>
    void navigate({ search: (prev) => ({ ...prev, lecon: id }) })

  const ask = async (title: string) => {
    setAsking(title)
    setError('')
    try {
      const { id } = await requestLesson({
        data: { matiere: data.matiere, chapitre: title },
      })
      setChapitre('')
      open(id)
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : 'Le Professeur IA est momentanément indisponible.',
      )
    } finally {
      setAsking(null)
    }
  }

  if (search.lecon)
    return (
      <LessonLoader
        key={search.lecon}
        id={search.lecon}
        onExit={() =>
          void navigate({ search: (prev) => ({ ...prev, lecon: undefined }) })
        }
      />
    )

  const ready = data.lessons.filter((l) => l.status === 'ready')
  const others = data.lessons.filter((l) => l.status !== 'ready')
  const programme = data.programme

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <p className="text-sm font-semibold text-secondary">Professeur IA</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold sm:text-3xl">
          Bonjour {s.firstName} ! Aujourd’hui, tu as envie d’apprendre quelle
          leçon ?
        </h1>
        <p className="mt-2 text-muted-foreground">
          Leçons de {s.classe} {s.serie}, rédigées par le Professeur IA selon le
          programme ivoirien. Chaque leçon s’ouvre en quelques secondes et se
          fait en 4 temps (comprendre, retenir, un exemple résolu puis un
          exercice à toi, les pièges), avec une question de vérification après
          chaque temps. Dès que tu as fini : le test de fin de leçon.
        </p>
        <p className="mt-3 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
          Méthode qui marche : lis un temps, réponds à sa question de
          vérification sans tricher, puis fais l’exercice « À toi de jouer »
          avant de passer à la suite. Le test final débloque la révision
          J+1 / J+3 / J+7.
        </p>
      </section>

      {data.due.length > 0 && (
        <section
          aria-labelledby="a-reviser"
          className="rounded-2xl border border-primary/50 bg-primary/5 p-5"
        >
          <h2
            id="a-reviser"
            className="flex items-center gap-2 text-lg"
          >
            <BellRing className="size-5 text-primary" aria-hidden="true" /> À
            réviser aujourd’hui
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {data.due.map((d) => (
              <li key={d.id}>
                <Link
                  to="/lecons"
                  search={{ matiere: d.matiere, lecon: d.id }}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold hover:border-primary"
                >
                  <span aria-hidden="true">{matiereById(d.matiere)?.emoji}</span>
                  {d.titre}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div>
        <h2 className="mb-3 text-lg">1. Choisis ta matière</h2>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {matieres.map((m) => (
            <Link
              key={m.id}
              to="/lecons"
              search={{ matiere: m.id }}
              aria-current={data.matiere === m.id ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-sm font-semibold',
                data.matiere === m.id && 'border-ink bg-ink text-ink-foreground',
              )}
            >
              <span aria-hidden="true">{m.emoji}</span> {m.nom}
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg">2. Choisis ton chapitre</h2>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <ProgrammeList
          programme={programme}
          classe={`${s.classe} ${s.serie}`.trim()}
          matiere={matiere?.nom ?? 'cette matière'}
          asking={asking}
          onOpen={open}
          onAsk={(c) => void ask(c)}
        />

        {ready.length > 0 && (
          <p className="text-sm font-semibold text-muted-foreground">
            Autres leçons demandées par ta classe
          </p>
        )}
        {ready.length > 0 && (
          <ul className="grid gap-3 md:grid-cols-2">
            {ready.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => open(l.id)}
                  className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-3 text-left shadow-sm hover:border-primary"
                >
                  <span>
                    <span className="block font-semibold">{l.titre}</span>
                    <span className="text-sm text-muted-foreground">
                      {l.chapitre}
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {others.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {others.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() =>
                    l.status === 'failed' ? void ask(l.chapitre) : open(l.id)
                  }
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-dashed border-border bg-card px-4 text-sm"
                >
                  {l.status === 'preparing' ? (
                    <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  ) : (
                    <RotateCcw className="size-4" aria-hidden="true" />
                  )}
                  {l.chapitre}
                  <span className="text-xs text-muted-foreground">
                    {l.status === 'preparing' ? 'en rédaction' : 'réessayer'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {data.suggestions.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-muted-foreground">
              Chapitres de tes sujets de {matiere?.nom ?? 'cette matière'} : le
              Professeur IA rédige la leçon à la demande
            </p>
            <ul className="flex flex-wrap gap-2">
              {data.suggestions.map((c) => (
                <li key={c}>
                  <button
                    type="button"
                    disabled={asking !== null}
                    onClick={() => void ask(c)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold hover:border-primary disabled:opacity-60"
                  >
                    {asking === c ? (
                      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    ) : (
                      <Sparkles className="size-4 text-secondary" aria-hidden="true" />
                    )}
                    {c}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <form
          className="rounded-2xl border border-border bg-card p-5"
          onSubmit={(e) => {
            e.preventDefault()
            if (chapitre.trim().length >= 3) void ask(chapitre.trim())
          }}
        >
          <label htmlFor="chapitre" className="font-semibold">
            {ready.length + data.suggestions.length + programme.chapitres.length > 0
              ? 'Un autre chapitre ?'
              : `Quel chapitre de ${matiere?.nom ?? 'cette matière'} veux-tu apprendre ?`}
          </label>
          <p className="text-sm text-muted-foreground">
            Écris le nom du chapitre tel qu’il figure dans ton cahier (par
            exemple « Les fractions », « La Révolution française »).
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              id="chapitre"
              value={chapitre}
              maxLength={120}
              onChange={(e) => setChapitre(e.target.value)}
              placeholder="Nom du chapitre"
              className="min-h-11 rounded-xl"
            />
            <Button
              type="submit"
              className="min-h-11 rounded-full px-5 font-bold"
              disabled={chapitre.trim().length < 3 || asking !== null}
            >
              {asking === chapitre.trim() ? (
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <Sparkles className="size-4" aria-hidden="true" />
              )}
              Apprendre ce chapitre
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

type Catalog = Awaited<ReturnType<typeof getLessonCatalog>>

/** Programme officiel de la matière pour la classe : chapitres dans l'ordre de l'année. */
function ProgrammeList({
  programme,
  classe,
  matiere,
  asking,
  onOpen,
  onAsk,
}: {
  programme: Catalog['programme']
  classe: string
  matiere: string
  asking: string | null
  onOpen: (id: string) => void
  onAsk: (chapitre: string) => void
}) {
  const router = useRouter()
  const waiting =
    programme.status === 'preparing' ||
    programme.chapitres.some((c) => c.status === 'preparing')
  // Programme ou leçons en rédaction : la liste se met à jour toute seule.
  useEffect(() => {
    if (!waiting) return
    const id = window.setInterval(() => void router.invalidate(), 15_000)
    return () => window.clearInterval(id)
  }, [waiting, router])

  if (programme.status !== 'ready')
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-dashed border-border bg-card p-5 text-sm">
        {programme.status === 'preparing' ? (
          <Loader2
            className="mt-0.5 size-4 shrink-0 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : (
          <RotateCcw className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        )}
        <p role="status">
          {programme.status === 'preparing'
            ? `Le Professeur IA établit le programme de ${matiere} en ${classe}. Les premières leçons arrivent dans quelques minutes ; cette page se met à jour toute seule.`
            : `Le programme de ${matiere} n’a pas pu être établi pour l’instant. Il sera réessayé cette nuit ; tu peux déjà demander un chapitre ci-dessous.`}
        </p>
      </div>
    )
  const prets = programme.chapitres.filter((c) => c.status === 'ready').length
  return (
    <section
      aria-labelledby="programme"
      className="rounded-2xl border border-border bg-card p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="programme" className="font-display text-lg font-bold">
          Programme de {matiere} · {classe}
        </h3>
        <p className="text-sm text-muted-foreground">
          {prets}/{programme.chapitres.length} leçons prêtes
        </p>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Les chapitres sont dans l’ordre de l’année. Le Professeur IA rédige les
        suivants chaque nuit ; touche un chapitre pour l’avoir tout de suite.
      </p>
      <ol className="mt-4 grid gap-2 md:grid-cols-2">
        {programme.chapitres.map((c) => (
          <li key={c.numero}>
            <button
              type="button"
              disabled={asking !== null && c.status !== 'ready'}
              onClick={() =>
                c.id && c.status !== 'failed' ? onOpen(c.id) : onAsk(c.chapitre)
              }
              className={cn(
                'flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 py-2 text-left text-sm disabled:opacity-60',
                c.status === 'ready'
                  ? 'border-border bg-background font-semibold hover:border-primary'
                  : 'border-dashed border-border',
              )}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold">
                {c.numero}
              </span>
              <span className="flex-1">{c.titre}</span>
              {c.status === 'ready' ? (
                <Check className="size-4 shrink-0 text-secondary" aria-label="Leçon prête" />
              ) : c.status === 'preparing' || asking === c.chapitre ? (
                <Loader2
                  className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
                  aria-label="En rédaction"
                />
              ) : (
                <Sparkles className="size-4 shrink-0 text-secondary" aria-label="À rédiger" />
              )}
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}

type LiveEvent =
  | { type: 'start' | 'wait' | 'ready' | 'fallback' | 'hors_programme' }
  | { type: 'lecon'; lecon: LeconIA & { complet: boolean } }
  | { type: 'error'; message: string }

/** Rédaction express : lit le flux de /api/lecon-direct (une ligne JSON par mise à jour). */
async function streamLesson(
  id: string,
  onLecon: (lecon: LeconIA) => void,
  signal: AbortSignal,
): Promise<'ready' | 'wait' | 'fallback' | 'hors_programme' | 'error'> {
  const res = await fetch('/api/lecon-direct', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ id }),
    signal,
  })
  if (!res.ok || !res.body) return 'error'
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let last: 'ready' | 'wait' | 'fallback' | 'hors_programme' | 'error' = 'fallback'
  const handle = (line: string) => {
    if (!line.trim()) return
    let event: LiveEvent
    try {
      event = JSON.parse(line) as LiveEvent
    } catch {
      return
    }
    if (event.type === 'lecon') onLecon(event.lecon)
    else if (event.type === 'error') last = 'error'
    else if (event.type !== 'start') last = event.type
  }
  for (;;) {
    const { done, value } = await reader.read()
    if (value) buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    lines.forEach(handle)
    if (done) break
  }
  handle(buffer)
  return last
}

type LoaderState =
  | { kind: 'loading' }
  | { kind: 'preparing'; chapitre: string }
  | { kind: 'lecon'; lecon: LeconIA; enCours: boolean }
  | { kind: 'failed'; horsProgramme: boolean; chapitre: string }
  | { kind: 'missing' }

/**
 * Charge la leçon. Si elle n'est pas encore rédigée, le Professeur IA l'écrit en direct :
 * le 1er temps s'affiche en quelques secondes et la suite arrive pendant la lecture.
 * Si quelqu'un d'autre la rédige déjà, on vérifie toutes les 3 secondes.
 */
function LessonLoader({ id, onExit }: { id: string; onExit: () => void }) {
  const router = useRouter()
  const [state, setState] = useState<LoaderState>({ kind: 'loading' })
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), 20_000)
    return () => window.clearTimeout(t)
  }, [id])
  useEffect(() => {
    let alive = true
    let streamed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const controller = new AbortController()
    const load = async (): Promise<void> => {
      try {
        const res = await getLesson({ data: { id } })
        if (!alive) return
        if (res.status === 'ready') {
          setState({ kind: 'lecon', lecon: res.lecon, enCours: false })
          void router.invalidate()
          return
        }
        if (res.status === 'missing') return setState({ kind: 'missing' })
        if (res.status === 'failed')
          return setState({ kind: 'failed', horsProgramme: res.horsProgramme, chapitre: res.chapitre })
        setState((prev) => (prev.kind === 'lecon' ? prev : { kind: 'preparing', chapitre: res.chapitre }))
        if (res.direct && !streamed) {
          streamed = true
          const result = await streamLesson(
            id,
            (lecon) => alive && setState({ kind: 'lecon', lecon, enCours: true }),
            controller.signal,
          ).catch(() => 'error' as const)
          if (!alive) return
          if (result === 'hors_programme')
            return setState({ kind: 'failed', horsProgramme: true, chapitre: res.chapitre })
          return void load()
        }
        timer = setTimeout(() => void load(), 3000)
      } catch {
        if (alive) timer = setTimeout(() => void load(), 8000)
      }
    }
    void load()
    return () => {
      alive = false
      controller.abort()
      if (timer) clearTimeout(timer)
    }
  }, [id, router])

  if (state.kind === 'lecon')
    return <LessonFlow lecon={state.lecon} enCours={state.enCours} onExit={onExit} />

  return (
    <div className="mx-auto max-w-reading space-y-4">
      <button
        type="button"
        onClick={onExit}
        className="min-h-11 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        ← Changer de leçon
      </button>
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        {state.kind === 'loading' || state.kind === 'preparing' ? (
          <div role="status" className="space-y-3">
            <p className="inline-flex items-center gap-2 font-semibold">
              <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              {state.kind === 'preparing'
                ? `Le Professeur IA rédige ta leçon « ${state.chapitre} »…`
                : 'Chargement de la leçon…'}
            </p>
            {state.kind === 'preparing' && (
              <>
                <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div className="h-full w-1/3 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {!slow
                    ? 'La première partie s’affiche dans quelques secondes ; la suite s’écrit pendant que tu lis.'
                    : 'Ça prend un peu plus de temps que d’habitude : le Professeur IA vérifie toute la leçon. Elle s’ouvre dès qu’elle est prête.'}
                </p>
              </>
            )}
          </div>
        ) : state.kind === 'failed' ? (
          <p role="alert">
            {state.horsProgramme
              ? `« ${state.chapitre} » ne fait pas partie du programme de ta classe dans cette matière. Vérifie le nom du chapitre dans ton cahier.`
              : 'La leçon n’a pas pu être rédigée. Reviens à la liste et réessaie.'}
          </p>
        ) : (
          <p role="alert">Cette leçon est introuvable.</p>
        )}
      </section>
    </div>
  )
}

/** Question de vérification après chaque temps (récupération active, correction immédiate). */
function CheckQuestion({
  check,
  answer,
  onAnswer,
  onRephrase,
}: {
  check: Verification
  answer: number | undefined
  onAnswer: (choice: number) => void
  onRephrase: () => void
}) {
  const answered = answer !== undefined
  const juste = answer === check.bonne
  return (
    <div className="mt-6 rounded-xl border border-border bg-background p-4">
      <p className="inline-flex items-center gap-2 text-sm font-semibold text-secondary">
        <ListChecks className="size-4" aria-hidden="true" /> Vérifie-toi
      </p>
      <p className="mt-1 font-semibold">{check.question}</p>
      <div className="mt-3 grid gap-2" role="radiogroup" aria-label={check.question}>
        {check.choix.map((c, idx) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={answer === idx}
            disabled={answered}
            onClick={() => onAnswer(idx)}
            className={cn(
              'min-h-11 rounded-xl border border-border px-4 py-2 text-left text-sm',
              !answered && 'hover:border-primary',
              answered && idx === check.bonne && 'border-secondary bg-secondary/10 font-semibold',
              answered && answer === idx && !juste && 'border-destructive bg-destructive/10',
            )}
          >
            {c}
          </button>
        ))}
      </div>
      {answered && (
        <div aria-live="polite" className="mt-3 text-sm">
          <p className={cn('font-semibold', juste ? 'text-secondary' : 'text-destructive')}>
            {juste ? 'Bravo, c’est juste !' : 'Pas tout à fait.'}
          </p>
          <p className="mt-1">{check.explication}</p>
          {!juste && (
            <button
              type="button"
              onClick={onRephrase}
              className="mt-2 min-h-11 font-semibold text-primary hover:underline"
            >
              Réexplique-moi cette partie autrement
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Ligne de leçon : met en valeur les mini-exemples (« Ex. : ») et les étapes (« Étape 1 — »). */
function LessonLine({ text }: { text: string }) {
  const ex = text.match(/^(.*?)\s*(?:Ex\.|Exemple)\s*:\s*(.+)$/s)
  const etape = text.match(/^((?:Étape|Etape)\s*\d+|Énoncé|Conclusion|Piège)\s*([—:–-])\s*(.+)$/s)
  if (etape)
    return (
      <p>
        <span className="font-semibold text-primary">{etape[1]} {etape[2]}</span> {etape[3]}
      </p>
    )
  if (ex && ex[1])
    return (
      <div>
        <p>{ex[1]}</p>
        <p className="mt-1 border-l-4 border-secondary/50 pl-3 text-sm text-muted-foreground">
          <span className="font-semibold text-secondary">Par exemple : </span>
          {ex[2]}
        </p>
      </div>
    )
  return <p>{text}</p>
}

/** Mots difficiles du chapitre, expliqués simplement avant de commencer. */
function MotsCles({ mots }: { mots: MotCle[] }) {
  return (
    <div className="mt-4">
      <h3 className="inline-flex items-center gap-2 text-sm font-semibold">
        <BookMarked className="size-4 text-primary" aria-hidden="true" /> Les mots à connaître
      </h3>
      <dl className="mt-2 grid gap-2 sm:grid-cols-2">
        {mots.map((m) => (
          <div key={m.mot} className="rounded-xl bg-muted/60 p-3 text-sm">
            <dt className="font-semibold">{m.mot}</dt>
            <dd className="text-muted-foreground">{m.sens}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** Formules, règles ou dates clés : la formule exacte, son sens en mots simples et un mini-exemple. */
function FormulesBlock({ formules }: { formules: Formule[] }) {
  return (
    <div className="mt-6">
      <h3 className="inline-flex items-center gap-2 font-semibold">
        <Sigma className="size-4 text-primary" aria-hidden="true" /> Formules et règles à connaître
      </h3>
      <ul className="mt-3 space-y-3">
        {formules.map((f) => (
          <li key={f.nom + f.formule} className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{f.nom}</p>
            <p className="mt-1 rounded-lg bg-primary/10 px-3 py-2 font-display text-lg font-bold">{f.formule}</p>
            <p className="mt-2 text-sm">
              <span className="font-semibold">Ce que ça veut dire : </span>
              {f.sens}
            </p>
            {f.exemple && (
              <p className="mt-1 border-l-4 border-secondary/50 pl-3 text-sm text-muted-foreground">
                <span className="font-semibold text-secondary">Par exemple : </span>
                {f.exemple}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Exemples résolus supplémentaires : l'élève essaie, puis affiche la correction détaillée. */
function AutresExemples({ exemples }: { exemples: ExempleResolu[] }) {
  const [ouverts, setOuverts] = useState<number[]>([])
  return (
    <div className="mt-6">
      <h3 className="font-semibold">Encore {exemples.length > 1 ? `${exemples.length} exemples` : 'un exemple'} pour bien comprendre</h3>
      <ul className="mt-3 space-y-3">
        {exemples.map((e, idx) => {
          const ouvert = ouverts.includes(idx)
          return (
            <li key={e.titre + e.enonce} className="rounded-xl border border-border bg-background p-4">
              <p className="text-sm font-semibold text-primary">{e.titre}</p>
              <p className="mt-1 whitespace-pre-line">{e.enonce}</p>
              {ouvert ? (
                <div aria-live="polite" className="mt-3 space-y-2 rounded-lg bg-secondary/10 p-3 text-sm leading-relaxed">
                  {e.solution.map((l) => (
                    <LessonLine key={l} text={l} />
                  ))}
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="mt-3 min-h-11 rounded-full"
                  onClick={() => setOuverts((o) => [...o, idx])}
                >
                  Voir la correction
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Points à retenir : le résumé du chapitre à réciter avant l'examen. */
function PointsARetenir({ points }: { points: string[] }) {
  return (
    <div className="mt-6 rounded-xl border-2 border-secondary/50 bg-secondary/10 p-4">
      <h3 className="inline-flex items-center gap-2 font-semibold">
        <Check className="size-4 text-secondary" aria-hidden="true" /> Les points à retenir
      </h3>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
        {points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-muted-foreground">Récite-les à voix haute sans regarder : c’est la meilleure façon de les retenir.</p>
    </div>
  )
}

/** « À toi de jouer » : exercice semblable à l'exemple, indices progressifs puis solution. */
function PratiqueBlock({ pratique }: { pratique: Pratique }) {
  const [indices, setIndices] = useState(0)
  const [solution, setSolution] = useState(false)
  return (
    <div className="paper-lined mt-6 rounded-xl border-2 border-dashed border-primary/40 p-4">
      <p className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
        <PencilLine className="size-4" aria-hidden="true" /> À toi de jouer
      </p>
      <p className="mt-1 whitespace-pre-line">{pratique.enonce}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Cherche d’abord seul sur ton cahier, puis demande un indice si tu bloques.
      </p>
      {pratique.indices.slice(0, indices).map((h, idx) => (
        <p key={h} className="mt-2 rounded-lg bg-primary/5 p-2 text-sm">
          <span className="font-semibold">Indice {idx + 1} : </span>
          {h}
        </p>
      ))}
      {solution && (
        <div aria-live="polite" className="mt-3 space-y-1 rounded-lg bg-secondary/10 p-3 text-sm">
          <p className="font-semibold">Solution</p>
          {pratique.solution.map((l) => (
            <p key={l}>{l}</p>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {indices < pratique.indices.length && !solution && (
          <Button variant="outline" className="min-h-11 rounded-full" onClick={() => setIndices(indices + 1)}>
            <Lightbulb className="size-4" aria-hidden="true" /> Un indice
          </Button>
        )}
        {!solution && (
          <Button variant="outline" className="min-h-11 rounded-full" onClick={() => setSolution(true)}>
            Voir la solution
          </Button>
        )}
      </div>
    </div>
  )
}

type TestResult = Awaited<ReturnType<typeof submitLessonTest>>

/** Test de fin de leçon : QCM de 6 questions, du « retenir » à l'« analyser », corrigé tout de suite. */
function LessonTest({
  lecon,
  enCours,
  onReview,
  onResume,
}: {
  lecon: LeconIA
  enCours: boolean
  onReview: (key: LessonStepKey) => void
  onResume: () => void
}) {
  const [fetched, setFetched] = useState<TestQuestion[] | null>(null)
  const test = lecon.test?.length ? lecon.test : fetched
  const [loadError, setLoadError] = useState('')
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)
  const [error, setError] = useState('')

  // Leçon plus ancienne sans test : le Professeur IA le rédige tout de suite (une fois pour la classe).
  useEffect(() => {
    if (test || enCours || lecon.test?.length) return
    let alive = true
    getLessonTest({ data: { leconId: lecon.id } })
      .then((r) => alive && setFetched(r.test))
      .catch((e) => alive && setLoadError(e instanceof Error && e.message ? e.message : 'Le test n’a pas pu être préparé.'))
    return () => {
      alive = false
    }
  }, [test, enCours, lecon.id, lecon.test])

  if (!test)
    return (
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-xl">Test de fin de leçon</h2>
        {loadError ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {loadError}
          </p>
        ) : (
          <p role="status" className="mt-2 inline-flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            Le Professeur IA prépare ton test…
          </p>
        )}
      </section>
    )

  const tout = test.every((_, idx) => answers[idx] !== undefined)
  const send = async () => {
    setSending(true)
    setError('')
    try {
      setResult(
        await submitLessonTest({
          data: { leconId: lecon.id, answers: test.map((_, idx) => answers[idx] ?? -1) },
        }),
      )
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Le test n’a pas pu être corrigé. Réessaie.')
    } finally {
      setSending(false)
    }
  }
  const aRevoir = result
    ? [...new Set(test.filter((q, idx) => answers[idx] !== q.bonne).map((q) => q.etape))]
    : []

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-secondary">
          <Trophy className="size-4" aria-hidden="true" /> Tu as fini la leçon !
        </p>
        <h2 className="mt-1 text-xl">Test de fin de leçon · {test.length} questions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Réponds sans regarder la leçon : c’est en cherchant dans ta mémoire que tu retiens le mieux.
        </p>
        {result && (
          <div aria-live="polite" className="mt-4 rounded-xl border border-secondary/40 bg-secondary/10 p-4">
            <p className="font-display text-3xl font-extrabold">{result.note} / 10</p>
            <p className="mt-1">
              {result.bonnes} bonne{result.bonnes > 1 ? 's' : ''} réponse{result.bonnes > 1 ? 's' : ''} sur{' '}
              {result.total}.{' '}
              {result.note >= 8
                ? 'Excellent, tu maîtrises ce chapitre !'
                : result.note >= 6
                  ? 'Bien joué ! Revois les points ratés pour être au top.'
                  : 'Pas encore acquis : revois les parties indiquées puis refais le test.'}
            </p>
            {aRevoir.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {aRevoir.map((k) => (
                  <Button key={k} variant="outline" className="min-h-11 rounded-full" onClick={() => onReview(k)}>
                    Revoir : {STEP_TITLES[k]}
                  </Button>
                ))}
              </div>
            )}
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <BellRing className="size-4" aria-hidden="true" />
              Prochain rappel de cette leçon dans {result.rappelDans} jour{result.rappelDans > 1 ? 's' : ''}.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button className="min-h-11 rounded-full px-5 font-bold" onClick={onResume}>
                Résumer la leçon avec mes mots
              </Button>
              <Button
                variant="outline"
                className="min-h-11 rounded-full"
                onClick={() => {
                  setAnswers({})
                  setResult(null)
                }}
              >
                <RotateCcw className="size-4" aria-hidden="true" /> Refaire le test
              </Button>
            </div>
          </div>
        )}
      </div>

      <ol className="space-y-4">
        {test.map((q, idx) => {
          const choisi = answers[idx]
          const juste = choisi === q.bonne
          return (
            <li key={q.question} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Question {idx + 1} · {NIVEAU_QUESTION_LABEL[q.niveau]}
              </p>
              <p className="mt-1 font-semibold">{q.question}</p>
              <div className="mt-3 grid gap-2" role="radiogroup" aria-label={`Question ${idx + 1}`}>
                {q.choix.map((c, ci) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={choisi === ci}
                    disabled={!!result}
                    onClick={() => setAnswers((a) => ({ ...a, [idx]: ci }))}
                    className={cn(
                      'min-h-11 rounded-xl border border-border px-4 py-2 text-left text-sm',
                      !result && 'hover:border-primary',
                      !result && choisi === ci && 'border-ink bg-ink text-ink-foreground',
                      result && ci === q.bonne && 'border-secondary bg-secondary/10 font-semibold',
                      result && choisi === ci && !juste && 'border-destructive bg-destructive/10',
                    )}
                  >
                    <span className="mr-2 font-bold">{'ABCD'[ci]}.</span>
                    {c}
                  </button>
                ))}
              </div>
              {result && (
                <p className="mt-3 text-sm">
                  <span className={cn('font-semibold', juste ? 'text-secondary' : 'text-destructive')}>
                    {juste ? 'Juste. ' : 'Faux. '}
                  </span>
                  {q.explication}
                </p>
              )}
            </li>
          )
        })}
      </ol>

      {!result && (
        <div className="space-y-2">
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            className="min-h-11 rounded-full px-5 font-bold"
            disabled={!tout || sending}
            onClick={() => void send()}
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <Check className="size-4" aria-hidden="true" />
            )}
            {tout ? 'Valider mon test' : `Réponds aux ${test.length} questions`}
          </Button>
        </div>
      )}
    </section>
  )
}

type Stage = 'temps' | 'test' | 'rappel' | 'fini'

function LessonFlow({
  lecon,
  enCours,
  onExit,
}: {
  lecon: LeconIA
  enCours: boolean
  onExit: () => void
}) {
  const [i, setI] = useState(0)
  const [simpler, setSimpler] = useState(false)
  const [stage, setStage] = useState<Stage>('temps')
  const [checks, setChecks] = useState<Partial<Record<LessonStepKey, number>>>({})
  const [resume, setResume] = useState('')
  const [aiText, setAiText] = useState<Record<string, string>>({})
  const [rephrasing, setRephrasing] = useState(false)
  const [grading, setGrading] = useState(false)
  const [gradeError, setGradeError] = useState('')
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof gradeLessonSummary>
  > | null>(null)
  const step = lecon.etapes[Math.min(i, lecon.etapes.length - 1)]
  const check = lecon.verifications?.[step.key]
  const isLast = i >= STEP_KEYS.length - 1
  const nextReady = isLast || i + 1 < lecon.etapes.length

  // Le chapitre suivant du programme se prépare pendant que l'élève étudie celui-ci.
  useEffect(() => {
    if (enCours) return
    void prepareNextLesson({ data: { leconId: lecon.id } }).catch(() => undefined)
  }, [enCours, lecon.id])

  const rephrase = async () => {
    setSimpler(true)
    if (aiText[step.key] || rephrasing || enCours) return
    setRephrasing(true)
    try {
      const { text } = await rephraseLessonStep({
        data: { leconId: lecon.id, etape: step.key },
      })
      setAiText((t) => ({ ...t, [step.key]: text }))
    } catch {
      // La reformulation préparée reste affichée.
    } finally {
      setRephrasing(false)
    }
  }

  const grade = async () => {
    setGrading(true)
    setGradeError('')
    try {
      setResult(
        await gradeLessonSummary({ data: { leconId: lecon.id, resume } }),
      )
      setStage('fini')
    } catch (e) {
      setGradeError(
        e instanceof Error && e.message
          ? e.message
          : 'Le Professeur IA est momentanément indisponible. Réessaie.',
      )
    } finally {
      setGrading(false)
    }
  }
  const goTo = (key: LessonStepKey) => {
    const idx = lecon.etapes.findIndex((e) => e.key === key)
    if (idx < 0) return
    setI(idx)
    setSimpler(false)
    setStage('temps')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="mx-auto max-w-reading space-y-6">
      <button
        type="button"
        onClick={onExit}
        className="min-h-11 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        ← Changer de leçon
      </button>
      <header>
        <div className="flex items-center gap-2">
          <ExempleBadge />
          <span className="text-sm text-muted-foreground">
            {lecon.chapitre}
          </span>
        </div>
        <h1 className="mt-2 font-display text-3xl font-extrabold">
          {lecon.titre}
        </h1>
        {enCours && (
          <p role="status" className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            Le Professeur IA écrit la suite pendant que tu lis…
          </p>
        )}
      </header>

      {(lecon.objectifs?.length || lecon.amorce || lecon.motsCles?.length) && stage === 'temps' && i === 0 && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          {lecon.objectifs?.length ? (
            <>
              <h2 className="inline-flex items-center gap-2 text-base">
                <Target className="size-4 text-primary" aria-hidden="true" /> À la fin de cette leçon
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {lecon.objectifs.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </>
          ) : null}
          {lecon.amorce && (
            <p className="mt-3 rounded-xl bg-primary/5 p-3 text-sm">
              <span className="font-semibold">Pour commencer, réfléchis : </span>
              {lecon.amorce}
            </p>
          )}
          {!!lecon.motsCles?.length && <MotsCles mots={lecon.motsCles} />}
        </section>
      )}

      {!enCours && <ExplainLesson key={lecon.id} leconId={lecon.id} />}

      <ol
        aria-label="Les 4 temps de la leçon, puis le test"
        className="grid grid-cols-5 gap-2"
      >
        {STEP_KEYS.map((key, idx) => {
          const pret = idx < lecon.etapes.length
          return (
            <li
              key={key}
              aria-current={stage === 'temps' && idx === i ? 'step' : undefined}
              className={cn(
                'rounded-xl border border-border px-1 py-2 text-center text-xs font-semibold',
                (idx < i || stage !== 'temps') &&
                  'border-secondary/50 bg-secondary/10 text-secondary',
                stage === 'temps' &&
                  idx === i &&
                  'border-primary bg-primary/10 text-foreground',
                !pret && 'border-dashed text-muted-foreground',
              )}
            >
              <span className="block font-display text-base">
                {pret ? (
                  idx + 1
                ) : (
                  <Loader2 className="mx-auto size-4 animate-spin motion-reduce:animate-none" aria-label="En rédaction" />
                )}
              </span>
              {STEP_TITLES[key]}
            </li>
          )
        })}
        <li
          aria-current={stage === 'test' ? 'step' : undefined}
          className={cn(
            'rounded-xl border border-border px-1 py-2 text-center text-xs font-semibold',
            stage === 'test' && 'border-primary bg-primary/10 text-foreground',
            (stage === 'rappel' || stage === 'fini') && 'border-secondary/50 bg-secondary/10 text-secondary',
          )}
        >
          <Trophy className="mx-auto size-5" aria-hidden="true" />
          Test
        </li>
      </ol>

      {stage === 'temps' && (
        <section
          aria-live="polite"
          className="rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <h2 className="text-xl">
            Temps {i + 1} · {step.titre}
          </h2>
          <div
            className={cn(
              'mt-4 space-y-3 leading-relaxed',
              step.key === 'memo' &&
                'rounded-xl border-2 border-primary/40 bg-primary/5 p-4',
            )}
          >
            {step.contenu.map((p) => (
              <LessonLine key={p} text={p} />
            ))}
          </div>
          {step.key === 'memo' && !!lecon.formules?.length && <FormulesBlock formules={lecon.formules} />}
          {step.key === 'exemple' && !!lecon.exemples?.length && (
            <AutresExemples key={lecon.id} exemples={lecon.exemples} />
          )}
          {step.key === 'pieges' && !!lecon.retenir?.length && <PointsARetenir points={lecon.retenir} />}
          {step.key === 'exemple' && lecon.pratique && (
            <PratiqueBlock key={lecon.id} pratique={lecon.pratique} />
          )}
          {simpler && (
            <div
              aria-live="polite"
              className="mt-4 space-y-3 rounded-xl bg-secondary/10 p-4 text-sm"
            >
              {lecon.reformulations[step.key] && (
                <p>
                  <span className="font-semibold">Autrement dit : </span>
                  {lecon.reformulations[step.key]}
                </p>
              )}
              {rephrasing && (
                <p className="inline-flex items-center gap-2 text-muted-foreground">
                  <Loader2
                    className="size-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  Le Professeur IA prépare une autre explication…
                </p>
              )}
              {aiText[step.key] && (
                <div className="border-t border-secondary/30 pt-3">
                  <p className="mb-1 inline-flex items-center gap-1 font-semibold text-secondary">
                    <Sparkles className="size-4" aria-hidden="true" />{' '}
                    Professeur IA
                  </p>
                  <p className="whitespace-pre-line">{aiText[step.key]}</p>
                </div>
              )}
            </div>
          )}
          {check && (
            <CheckQuestion
              key={`${lecon.id}-${step.key}`}
              check={check}
              answer={checks[step.key]}
              onAnswer={(c) => setChecks((v) => ({ ...v, [step.key]: c }))}
              onRephrase={() => void rephrase()}
            />
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              className="min-h-11 rounded-full px-5 font-bold"
              disabled={!nextReady || (!!check && checks[step.key] === undefined)}
              onClick={() => {
                setSimpler(false)
                window.scrollTo({ top: 0, behavior: 'smooth' })
                if (!isLast) setI(i + 1)
                else {
                  setStage('test')
                  speak('Bravo, tu as fini la leçon ! Place au test.')
                }
              }}
            >
              {!nextReady ? (
                <>
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> La suite
                  arrive…
                </>
              ) : check && checks[step.key] === undefined ? (
                'Réponds à la question pour continuer'
              ) : isLast ? (
                <>
                  <Trophy className="size-4" aria-hidden="true" /> J’ai fini, place au test
                </>
              ) : (
                <>
                  <Check className="size-4" aria-hidden="true" /> J’ai compris, suivant
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="min-h-11 rounded-full"
              disabled={rephrasing}
              onClick={() => void rephrase()}
            >
              <RotateCcw className="size-4" aria-hidden="true" /> Réexplique
              autrement
            </Button>
          </div>
        </section>
      )}

      {stage === 'test' && (
        <LessonTest
          lecon={lecon}
          enCours={enCours}
          onReview={goTo}
          onResume={() => setStage('rappel')}
        />
      )}

      {stage === 'rappel' && (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-xl">Résume la leçon avec tes mots</h2>
          <p className="mt-1 text-muted-foreground">
            Dernière étape pour bien retenir : explique la leçon comme à un camarade.
          </p>
          <label htmlFor="resume" className="sr-only">
            Ton résumé
          </label>
          <Textarea
            id="resume"
            value={resume}
            onChange={(e) => setResume(e.target.value)}
            placeholder="Résume la leçon avec tes mots…"
            className="paper-lined mt-4 min-h-48 rounded-2xl"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Au moins 20 caractères. Astuce : cite les formules et les pièges
            dont tu te souviens.
          </p>
          {gradeError && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {gradeError}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              className="min-h-11 rounded-full px-5 font-bold"
              disabled={resume.trim().length < 20 || grading}
              onClick={() => void grade()}
            >
              {grading ? (
                <>
                  <Loader2
                    className="size-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />{' '}
                  Le Professeur IA corrige…
                </>
              ) : (
                'Envoyer mon résumé'
              )}
            </Button>
            <Button variant="outline" className="min-h-11 rounded-full" onClick={() => setStage('test')}>
              Revenir au test
            </Button>
          </div>
        </section>
      )}

      {stage === 'fini' && (
        <section
          aria-live="polite"
          className="rounded-2xl border border-secondary/40 bg-secondary/10 p-6"
        >
          <h2 className="text-xl">
            Ton résumé : {result?.note ?? '–'} / 10
          </h2>
          {result && (
            <div className="mt-3 space-y-4">
              <p className="whitespace-pre-line">{result.retour}</p>
              {result.oublis.length > 0 && (
                <div>
                  <h3 className="font-semibold">À compléter</h3>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {result.oublis.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <h3 className="font-semibold">Questions de rappel</h3>
                <ol className="mt-1 list-decimal space-y-1 pl-5">
                  {result.questions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ol>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild className="min-h-11 rounded-full px-5 font-bold">
                  <Link to="/ia" search={{ mode: 'Quiz' }}>
                    Répondre avec le tuteur
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  className="min-h-11 rounded-full"
                  onClick={() => {
                    setResult(null)
                    setResume('')
                    setStage('rappel')
                  }}
                >
                  Refaire le résumé
                </Button>
              </div>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <BellRing className="size-4" aria-hidden="true" />
                Prochain rappel de cette leçon dans {result.rappelDans} jour
                {result.rappelDans > 1 ? 's' : ''} : tu le retrouveras en haut
                de la page Leçons.
              </p>
            </div>
          )}
        </section>
      )}

      <section className="border-t border-border pt-6">
        <Link
          to="/explorer"
          search={{ matiere: lecon.matiere }}
          className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary hover:underline"
        >
          Entraîne-toi sur des sujets de {matiereById(lecon.matiere)?.nom ?? 'cette matière'}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </section>
    </div>
  )
}
