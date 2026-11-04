import { useEffect, useState } from 'react'
import { Flag, Lightbulb, Megaphone, ThumbsUp } from 'lucide-react'
import {
  listIdeas,
  reportSubject,
  submitIdea,
  voteIdea,
} from '@/lib/admin.functions'

const errorText = (e: unknown) =>
  e instanceof Error && e.message
    ? e.message
    : 'Une erreur est survenue. Réessaie.'

/** Bandeau de l'annonce globale publiée dans /admin. */
export function AnnouncementBanner({
  announcement,
}: {
  announcement:
    { message: string; niveau: 'info' | 'alerte' } | null | undefined
}) {
  if (!announcement) return null
  return (
    <div
      role={announcement.niveau === 'alerte' ? 'alert' : 'status'}
      className={`mb-5 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
        announcement.niveau === 'alerte'
          ? 'border-destructive/50 bg-destructive/10'
          : 'border-secondary/40 bg-secondary/10'
      }`}
    >
      <Megaphone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{announcement.message}</p>
    </div>
  )
}

/** « Signaler une erreur » sous un sujet : l'admin la retrouve dans Signalements. */
export function ReportSubjectButton({ subjectId }: { subjectId: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)
  if (state === 'sent')
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Merci ! Ton signalement a été transmis à l’équipe.
      </p>
    )
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground underline-offset-4 hover:underline"
      >
        <Flag className="size-4" aria-hidden="true" /> Signaler une erreur dans
        ce sujet
      </button>
    )
  return (
    <form
      className="space-y-2 rounded-2xl border border-border bg-card p-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setState('busy')
        setError(null)
        try {
          await reportSubject({ data: { subjectId, reason } })
          setState('sent')
        } catch (err) {
          setError(errorText(err))
          setState('idle')
        }
      }}
    >
      <label htmlFor="report-reason" className="text-sm font-semibold">
        Qu’est-ce qui ne va pas ?
      </label>
      <textarea
        id="report-reason"
        required
        minLength={5}
        maxLength={500}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="min-h-20 w-full rounded-xl border border-border bg-background p-3 text-sm"
        placeholder="Ex. : la question 3 n’a pas de solution, le barème ne fait pas 20 points…"
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          disabled={state === 'busy'}
          className="min-h-11 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          Envoyer
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-11 rounded-full border border-border px-4 text-sm font-semibold"
        >
          Annuler
        </button>
      </div>
    </form>
  )
}

type Idea = Awaited<ReturnType<typeof listIdeas>>[number]

/** Boîte à idées : proposer une amélioration et voter pour celles des autres. */
export function IdeaBox() {
  const [ideas, setIdeas] = useState<Idea[] | null>(null)
  const [texte, setTexte] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [tick, setTick] = useState(0)
  const load = () => setTick((t) => t + 1)
  useEffect(() => {
    let alive = true
    listIdeas().then(
      (list) => alive && setIdeas(list),
      (e) => alive && setError(errorText(e)),
    )
    return () => {
      alive = false
    }
  }, [tick])
  const statut: Record<string, string> = {
    retenue: 'Retenue',
    realisee: 'Réalisée',
  }
  return (
    <section
      aria-labelledby="idees-title"
      className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <Lightbulb className="size-5 text-primary" aria-hidden="true" />
        <h2 id="idees-title" className="font-display text-xl font-bold">
          Boîte à idées
        </h2>
      </div>
      <form
        className="space-y-2"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError(null)
          setSent(false)
          try {
            await submitIdea({ data: { texte } })
            setTexte('')
            setSent(true)
            load()
          } catch (err) {
            setError(errorText(err))
          } finally {
            setBusy(false)
          }
        }}
      >
        <label htmlFor="idee" className="text-sm text-muted-foreground">
          Une idée pour améliorer Annales+ ? Propose-la, les autres élèves
          peuvent voter.
        </label>
        <textarea
          id="idee"
          required
          minLength={10}
          maxLength={400}
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          className="min-h-20 w-full rounded-xl border border-border bg-background p-3 text-sm"
        />
        <button
          disabled={busy}
          className="min-h-11 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          Proposer mon idée
        </button>
        {sent && (
          <p role="status" className="text-sm text-muted-foreground">
            Merci, ton idée est publiée !
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>
      {ideas && ideas.length > 0 && (
        <ul className="divide-y divide-border">
          {ideas.map((i) => (
            <li
              key={i.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <p className="text-sm">
                {i.texte}
                {statut[i.status] && (
                  <span className="ml-2 rounded-full bg-secondary/15 px-2 py-0.5 text-xs font-semibold">
                    {statut[i.status]}
                  </span>
                )}
              </p>
              <button
                type="button"
                disabled={i.voted || i.mine}
                aria-label={`Voter pour cette idée (${i.votes} vote${i.votes > 1 ? 's' : ''})`}
                onClick={async () => {
                  try {
                    await voteIdea({ data: { id: i.id } })
                    load()
                  } catch (e) {
                    setError(errorText(e))
                  }
                }}
                className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-border px-3 text-sm font-semibold disabled:opacity-60"
              >
                <ThumbsUp className="size-4" aria-hidden="true" /> {i.votes}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
