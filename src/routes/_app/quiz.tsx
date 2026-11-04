import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Flame, Loader2, Timer, X } from 'lucide-react'
import { ExempleBadge } from '@/components/app/brand'
import { Button } from '@/components/ui/button'
import { matiereById } from '@/lib/curriculum'
import { cn } from '@/lib/utils'
import {
  getDailyQuiz,
  startDailyQuiz,
  submitDailyQuiz,
} from '@/lib/quiz.functions'

export const Route = createFileRoute('/_app/quiz')({
  loader: () => getDailyQuiz(),
  head: () => ({
    meta: [
      { title: 'Quiz du jour — Annales+' },
      {
        name: 'description',
        content:
          'Chaque jour, 10 questions de ta classe en 20 secondes chacune. Garde ta série de jours !',
      },
      { property: 'og:title', content: 'Quiz du jour — Annales+' },
      {
        property: 'og:description',
        content: '10 questions par jour pour réviser toutes tes matières.',
      },
    ],
  }),
  component: QuizPage,
})

type Correction = {
  matiere: string
  question: string
  choix: string[]
  bonne: number
  explication: string
  reponse: number
}
type Result = {
  score: number
  total: number
  streak: number
  corrections: Correction[]
}

function QuizPage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const [questions, setQuestions] = useState<
    { matiere: string; question: string; choix: string[] }[] | null
  >(null)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)

  const preparing = data.status === 'preparing'
  useEffect(() => {
    if (!preparing) return
    const id = setInterval(() => void router.invalidate(), 10_000)
    return () => clearInterval(id)
  }, [preparing, router])

  const start = async () => {
    if (!('quizId' in data) || !data.quizId) return
    setStarting(true)
    setError('')
    try {
      const res = await startDailyQuiz({ data: { quizId: data.quizId } })
      setQuestions(res.questions)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Le quiz n’a pas pu démarrer.')
    } finally {
      setStarting(false)
    }
  }

  const finished: Result | null =
    result ??
    (data.status === 'done'
      ? {
          score: data.score,
          total: data.total,
          streak: data.streak,
          corrections: data.corrections,
        }
      : null)

  if (finished) return <QuizResult result={finished} />
  if (questions && 'quizId' in data && data.quizId)
    return (
      <QuizPlay
        quizId={data.quizId}
        questions={questions}
        seconds={data.secondsPerQuestion}
        onDone={setResult}
      />
    )

  return (
    <div className="mx-auto max-w-reading space-y-6">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-secondary">
            Quiz du jour · {data.classe} {data.serie}
          </p>
          <ExempleBadge />
        </div>
        <h1 className="mt-2 font-display text-3xl font-extrabold">
          {data.total} questions, {data.secondsPerQuestion} secondes chacune
        </h1>
        <p className="mt-2 text-muted-foreground">
          Toutes tes matières mélangées, le même quiz pour toute ta classe. Une
          seule tentative par jour : la correction s’affiche à la fin.
        </p>
        <StreakPill streak={data.streak} className="mt-4" />

        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}

        {data.status === 'preparing' && (
          <p
            role="status"
            className="mt-5 flex items-center gap-2 rounded-xl border border-secondary/40 bg-secondary/10 px-4 py-3 text-sm"
          >
            <Loader2
              className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            Le quiz du jour se prépare pour ta classe. Il arrive dans une
            minute environ, cette page se met à jour toute seule.
          </p>
        )}
        {data.status === 'unavailable' && (
          <p className="mt-5 rounded-xl border border-dashed border-border p-4 text-sm">
            Le quiz du jour n’a pas pu être préparé. En attendant,{' '}
            <Link
              to="/ia"
              search={{ mode: 'Quiz' }}
              className="font-semibold text-primary underline"
            >
              demande un quiz au tuteur IA
            </Link>
            .
          </p>
        )}
        {(data.status === 'ready' || data.status === 'started') && (
          <Button
            className="mt-6 min-h-12 rounded-full px-6 text-base font-bold"
            disabled={starting}
            onClick={() => void start()}
          >
            {starting ? (
              <Loader2
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <Timer className="size-4" aria-hidden="true" />
            )}
            {data.status === 'started' ? 'Reprendre le quiz' : 'Commencer'}
          </Button>
        )}
      </section>
    </div>
  )
}

function StreakPill({
  streak,
  className,
}: {
  streak: number
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-sm font-semibold',
        className,
      )}
    >
      <Flame className="size-4 text-primary" aria-hidden="true" />
      {streak > 0
        ? `${streak} jour${streak > 1 ? 's' : ''} d’affilée`
        : 'Commence ta série aujourd’hui'}
    </span>
  )
}

function QuizPlay({
  quizId,
  questions,
  seconds,
  onDone,
}: {
  quizId: string
  questions: { matiere: string; question: string; choix: string[] }[]
  seconds: number
  onDone: (r: Result) => void
}) {
  const [i, setI] = useState(0)
  const [left, setLeft] = useState(seconds)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const answers = useRef<number[]>([])

  const send = useCallback(async () => {
    setSending(true)
    setError('')
    try {
      const padded = questions.map((_, k) => answers.current[k] ?? -1)
      onDone(await submitDailyQuiz({ data: { quizId, answers: padded } }))
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Ton résultat n’a pas pu être envoyé.',
      )
      setSending(false)
    }
  }, [onDone, questions, quizId])

  const answer = useCallback(
    (choice: number) => {
      answers.current[i] = choice
      if (i < questions.length - 1) {
        setI(i + 1)
        setLeft(seconds)
      } else void send()
    },
    [i, questions.length, seconds, send],
  )

  useEffect(() => {
    if (sending) return
    // Temps écoulé : la question compte comme sans réponse (-1).
    const id = setTimeout(
      () => (left <= 1 ? answer(-1) : setLeft((l) => l - 1)),
      1000,
    )
    return () => clearTimeout(id)
  }, [left, sending, answer])

  const q = questions[i]
  const m = matiereById(q.matiere)

  if (sending)
    return (
      <div className="mx-auto max-w-reading space-y-4 rounded-2xl border border-border bg-card p-6 text-center">
        {error ? (
          <>
            <p role="alert" className="text-destructive">
              {error}
            </p>
            <Button className="min-h-11 rounded-full" onClick={() => void send()}>
              Réessayer l’envoi
            </Button>
          </>
        ) : (
          <p role="status" className="inline-flex items-center gap-2">
            <Loader2
              className="size-5 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            Correction en cours…
          </p>
        )}
      </div>
    )

  return (
    <div className="mx-auto max-w-reading space-y-5">
      <div className="flex items-center justify-between text-sm font-semibold">
        <span>
          Question {i + 1} / {questions.length}
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1 tabular-nums',
            left <= 5 && 'text-destructive',
          )}
          aria-live="off"
        >
          <Timer className="size-4" aria-hidden="true" /> {left} s
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Temps restant"
        aria-valuemin={0}
        aria-valuemax={seconds}
        aria-valuenow={left}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
          style={{ width: `${(left / seconds) * 100}%` }}
        />
      </div>
      <section
        aria-live="polite"
        className="rounded-2xl border border-border bg-card p-6 shadow-sm"
      >
        <p className="text-sm font-semibold text-muted-foreground">
          <span aria-hidden="true">{m?.emoji}</span> {m?.nom ?? q.matiere}
        </p>
        <h1 className="mt-2 whitespace-pre-line font-display text-xl font-bold leading-snug sm:text-2xl">
          {q.question}
        </h1>
        <ul className="mt-5 grid gap-3">
          {q.choix.map((c, k) => (
            <li key={`${i}-${k}`}>
              <button
                type="button"
                onClick={() => answer(k)}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-border bg-background px-4 py-2 text-left font-semibold hover:border-primary focus-visible:border-primary"
              >
                <span
                  className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-xs text-ink-foreground"
                  aria-hidden="true"
                >
                  {'ABCD'[k]}
                </span>
                {c}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function QuizResult({ result }: { result: Result }) {
  const ratio = result.total ? result.score / result.total : 0
  const message =
    ratio >= 0.9
      ? 'Excellent ! Tu maîtrises très bien.'
      : ratio >= 0.6
        ? 'Bien joué ! Revois les questions ratées.'
        : 'Courage ! Chaque erreur est une notion à revoir.'
  return (
    <div className="mx-auto max-w-reading space-y-6">
      <section className="rounded-2xl border border-secondary/40 bg-secondary/10 p-6">
        <p className="text-sm font-semibold text-secondary">Quiz du jour</p>
        <h1 className="mt-1 font-display text-4xl font-extrabold">
          {result.score} / {result.total}
        </h1>
        <p className="mt-1">{message}</p>
        <StreakPill streak={result.streak} className="mt-4" />
        <p className="mt-4 text-sm text-muted-foreground">
          Un nouveau quiz t’attend demain à partir de minuit (heure d’Abidjan).
        </p>
      </section>

      <section aria-labelledby="correction">
        <h2 id="correction" className="text-xl">
          Correction
        </h2>
        <ol className="mt-3 space-y-3">
          {result.corrections.map((c, i) => {
            const ok = c.reponse === c.bonne
            const m = matiereById(c.matiere)
            return (
              <li
                key={i}
                className={cn(
                  'rounded-2xl border bg-card p-5',
                  ok ? 'border-secondary/50' : 'border-destructive/40',
                )}
              >
                <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  {ok ? (
                    <Check className="size-4 text-secondary" aria-label="Juste" />
                  ) : (
                    <X className="size-4 text-destructive" aria-label="Faux" />
                  )}
                  {i + 1}. {m?.nom ?? c.matiere}
                </p>
                <p className="mt-2 whitespace-pre-line font-semibold">
                  {c.question}
                </p>
                <p className="mt-2 text-sm">
                  Bonne réponse :{' '}
                  <strong>
                    {'ABCD'[c.bonne]}. {c.choix[c.bonne]}
                  </strong>
                </p>
                {!ok && (
                  <p className="text-sm text-muted-foreground">
                    Ta réponse :{' '}
                    {c.reponse < 0
                      ? 'temps écoulé'
                      : `${'ABCD'[c.reponse]}. ${c.choix[c.reponse]}`}
                  </p>
                )}
                <p className="mt-2 text-sm">{c.explication}</p>
                {!ok && (
                  <Link
                    to="/lecons"
                    search={{ matiere: c.matiere }}
                    className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline"
                  >
                    Revoir la leçon de {m?.nom ?? c.matiere}
                  </Link>
                )}
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}
