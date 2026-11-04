import {
  createFileRoute,
  Link,
  notFound,
  redirect,
  useBlocker,
} from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  Camera,
  CheckCircle2,
  Hourglass,
  Lock,
  MessageCircle,
  Timer,
} from 'lucide-react'
import { ExempleBadge, Logo } from '@/components/app/brand'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { getSujet } from '@/lib/sujets.functions'
import { EXAM_SAS_MINUTES, WHATSAPP_URL, formatDuration } from '@/lib/config'
import { requireStudent } from '@/lib/require-student'
import { useNow } from '@/hooks/use-now'
import { useActivityBeat } from '@/hooks/use-activity-beat'

export const Route = createFileRoute('/examen/$sujetId')({
  beforeLoad: requireStudent,
  loader: async ({ params }) => {
    const sujet = await getSujet({ data: { id: params.sujetId } })
    if (!sujet) throw notFound()
    // Niveau Premium au forfait gratuit : la fiche du sujet explique comment le débloquer.
    if (sujet.verrouille)
      throw redirect({ to: '/sujets/$sujetId', params: { sujetId: sujet.id } })
    return { sujet }
  },
  head: () => ({
    meta: [
      { title: 'Épreuve en cours — Annales+' },
      {
        name: 'description',
        content: 'Épreuve chronométrée avec copie numérique.',
      },
      { property: 'og:title', content: 'Épreuve — Annales+' },
      {
        property: 'og:description',
        content: 'Épreuve chronométrée avec copie numérique.',
      },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: ExamPage,
})

type Saved = {
  startedAt: number
  text: string
  submittedAt?: number
  photos: number
}

// Aperçu : l'état est gardé dans le navigateur. Au jalon 5, le serveur fera foi
// (heure de début, autosauvegarde, verrouillage du corrigé et du tuteur).
function ExamPage() {
  const { sujet } = Route.useLoaderData()
  const key = `annales-exam-${sujet.id}`
  const [state, setState] = useState<Saved | null>(null)
  const [lastSave, setLastSave] = useState<Date | null>(null)
  const now = useNow(1000)
  // Le temps passé en épreuve compte dans le forfait gratuit, mais une épreuve commencée reste terminable.
  useActivityBeat()
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const raw = localStorage.getItem(key)
        if (raw) {
          setState(JSON.parse(raw) as Saved)
          return
        }
      } catch {
        /* ignore */
      }
      setState(null)
    })
    return () => cancelAnimationFrame(frame)
  }, [key])

  const persist = (next: Saved) => {
    setState(next)
    localStorage.setItem(key, JSON.stringify(next))
  }

  // Autosauvegarde toutes les 10 secondes.
  useEffect(() => {
    const id = setInterval(() => {
      const s = stateRef.current
      if (s && !s.submittedAt) {
        localStorage.setItem(key, JSON.stringify(s))
        setLastSave(new Date())
      }
    }, 10_000)
    return () => clearInterval(id)
  }, [key])

  const durationMs = sujet.dureeMin * 60_000
  const endsAt = state ? state.startedAt + durationMs : 0
  const remaining = state && now ? endsAt - now.getTime() : durationMs
  const phase: 'intro' | 'ecriture' | 'sas' | 'corrige' = !state
    ? 'intro'
    : !state.submittedAt && remaining > 0
      ? 'ecriture'
      : now &&
          now.getTime() <
            (state.submittedAt ?? endsAt) + EXAM_SAS_MINUTES * 60_000
        ? 'sas'
        : 'corrige'

  // Fin automatique du temps.
  const timeUp = !!state && !state.submittedAt && !!now && remaining <= 0
  useEffect(() => {
    const s = stateRef.current
    if (timeUp && s) {
      const next = { ...s, submittedAt: s.startedAt + durationMs }
      setState(next)
      localStorage.setItem(key, JSON.stringify(next))
    }
  }, [timeUp, durationMs, key])

  const blocker = useBlocker({
    shouldBlockFn: () => phase === 'ecriture',
    enableBeforeUnload: () => phase === 'ecriture',
    withResolver: true,
  })

  const [confirmOpen, setConfirmOpen] = useState(false)
  const sasLeft =
    state && now
      ? (state.submittedAt ?? endsAt) +
        EXAM_SAS_MINUTES * 60_000 -
        now.getTime()
      : 0

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-3 px-4 sm:px-6">
          {phase === 'ecriture' ? (
            <span className="inline-flex items-center gap-2 font-display font-bold">
              <Lock className="size-4 text-primary" aria-hidden="true" />{' '}
              Épreuve verrouillée
            </span>
          ) : (
            <Logo />
          )}
          {phase === 'ecriture' && (
            <span
              role="timer"
              aria-label="Temps restant"
              className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 font-mono text-lg font-bold ${remaining < 5 * 60_000 ? 'bg-destructive text-white' : 'bg-ink text-ink-foreground'}`}
            >
              <Timer className="size-4" aria-hidden="true" />
              {formatDuration(remaining, true)}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-content px-4 py-6 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <ExempleBadge />
          <h1 className="font-display text-xl font-extrabold sm:text-2xl">
            {sujet.titre}
          </h1>
        </div>

        {phase === 'intro' && (
          <section className="mx-auto max-w-reading rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-xl">Avant de commencer</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
              <li>
                Durée : {sujet.dureeMin} minutes. Le chronomètre démarre dès que
                tu commences.
              </li>
              <li>
                Le tuteur IA, les leçons et le corrigé sont verrouillés pendant
                l’épreuve.
              </li>
              <li>Tu ne peux pas quitter le sujet sans rendre ta copie.</li>
              <li>
                Ta copie est sauvegardée automatiquement toutes les 10 secondes.
              </li>
              <li>
                Le corrigé s’ouvre {EXAM_SAS_MINUTES} minutes après avoir rendu
                ta copie.
              </li>
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                size="lg"
                className="min-h-12 rounded-full px-6 font-bold"
                onClick={() =>
                  persist({ startedAt: Date.now(), text: '', photos: 0 })
                }
              >
                Commencer l’épreuve
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="min-h-12 rounded-full"
              >
                <Link to="/sujets/$sujetId" params={{ sujetId: sujet.id }}>
                  Retour
                </Link>
              </Button>
            </div>
          </section>
        )}

        {phase === 'ecriture' && state && (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <section
              aria-labelledby="sujet-enonce"
              className="rounded-2xl border border-border bg-card p-5 shadow-sm lg:sticky lg:top-20 lg:self-start"
            >
              <h2 id="sujet-enonce" className="text-lg">
                Énoncé
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">
                {sujet.enonce}
              </p>
              <p className="mt-4 text-xs text-muted-foreground">
                Barème : {sujet.bareme}
              </p>
            </section>
            <section aria-labelledby="copie" className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 id="copie" className="text-lg">
                  Ma copie
                </h2>
                <span
                  className="text-xs text-muted-foreground"
                  aria-live="polite"
                >
                  {lastSave
                    ? `Sauvegardée à ${lastSave.toLocaleTimeString('fr-FR')}`
                    : 'Sauvegarde automatique activée'}
                </span>
              </div>
              <label htmlFor="copie-texte" className="sr-only">
                Rédige ta copie
              </label>
              <textarea
                id="copie-texte"
                value={state.text}
                onChange={(e) => setState({ ...state, text: e.target.value })}
                placeholder="Rédige ta réponse ici…"
                className="paper-lined min-h-[28rem] w-full resize-y rounded-2xl border border-border pr-4 pt-[0.3rem] text-base shadow-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold hover:border-primary">
                  <Camera className="size-4" aria-hidden="true" /> Ajouter une
                  photo de copie
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      if (e.target.files?.length) {
                        persist({
                          ...state,
                          photos: state.photos + e.target.files.length,
                        })
                        toast.success('Photo ajoutée à ta copie')
                      }
                    }}
                  />
                </label>
                {state.photos > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {state.photos} photo(s) jointe(s)
                  </span>
                )}
                <Button
                  size="lg"
                  className="ml-auto min-h-12 rounded-full px-6 font-bold"
                  onClick={() => setConfirmOpen(true)}
                >
                  Rendre ma copie
                </Button>
              </div>
            </section>
          </div>
        )}

        {phase === 'sas' && (
          <section className="mx-auto max-w-reading rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <Hourglass
              className="mx-auto size-10 text-primary"
              aria-hidden="true"
            />
            <h2 className="mt-3 text-2xl">Copie rendue, bravo !</h2>
            <p className="mt-2 text-muted-foreground">
              Prends une pause. Le corrigé et le tuteur IA s’ouvrent dans :
            </p>
            <p role="timer" className="mt-4 font-mono text-5xl font-bold">
              {formatDuration(sasLeft, true).slice(3)}
            </p>
          </section>
        )}

        {phase === 'corrige' && (
          <section className="mx-auto max-w-reading space-y-4">
            <div className="rounded-2xl border border-secondary/40 bg-secondary/10 p-6">
              <CheckCircle2
                className="size-8 text-secondary"
                aria-hidden="true"
              />
              <h2 className="mt-2 text-2xl">Le corrigé est débloqué</h2>
              <p className="mt-1 text-muted-foreground">
                Le corrigé détaillé et l’auto-correction de ta copie par l’IA
                (note estimée et conseils) s’affichent ici.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                className="min-h-11 rounded-full"
                onClick={() => {
                  localStorage.removeItem(key)
                  setState(null)
                }}
              >
                Refaire l’épreuve
              </Button>
              <Button asChild className="min-h-11 rounded-full font-bold">
                <Link to="/explorer">Autres sujets</Link>
              </Button>
            </div>
          </section>
        )}

        <p className="mx-auto mt-10 max-w-reading text-center text-xs text-muted-foreground">
          Bloqué·e sur une épreuve ?{' '}
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-foreground underline"
          >
            <MessageCircle className="size-3.5" aria-hidden="true" /> Contacte
            le service client
          </a>
        </p>
      </main>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rendre ta copie ?</DialogTitle>
            <DialogDescription>
              Tu ne pourras plus la modifier. Le corrigé s’ouvrira dans{' '}
              {EXAM_SAS_MINUTES} minutes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Continuer à écrire
            </Button>
            <Button
              onClick={() => {
                if (state) persist({ ...state, submittedAt: Date.now() })
                setConfirmOpen(false)
              }}
            >
              Oui, je rends ma copie
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={blocker.status === 'blocked'}
        onOpenChange={(o) => !o && blocker.reset?.()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tu dois rendre ta copie avant de quitter</DialogTitle>
            <DialogDescription>
              L’épreuve est en cours. Termine-la ou rends ta copie pour accéder
              au reste de l’application.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => blocker.reset?.()}>
              Revenir à mon épreuve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
