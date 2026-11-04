import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { BookOpenCheck, Crown, Loader2, Lock, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ExempleBadge } from '@/components/app/brand'
import { usePlan } from '@/hooks/use-plan'
import {
  EXPLICATION_INFO,
  NIVEAUX_EXPLICATION,
  niveauxPour,
  type Explication,
  type NiveauExplication,
} from '@/lib/explication'
import { explainLesson } from '@/lib/lecons.functions'
import { cn } from '@/lib/utils'

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; explication: Explication }
  | { kind: 'error'; message: string }

/** « Explique-moi cette leçon » : profondeur de l'explication selon la formule de l'élève. */
export function ExplainLesson({ leconId }: { leconId: string }) {
  const { plan } = usePlan()
  const ouverts = niveauxPour(plan)
  const [niveau, setNiveau] = useState<NiveauExplication>(
    ouverts[ouverts.length - 1],
  )
  const [state, setState] = useState<State>({ kind: 'idle' })
  const timer = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
    },
    [],
  )
  const locked = !ouverts.includes(niveau)

  const run = async (n: NiveauExplication, tries = 0) => {
    if (timer.current) window.clearTimeout(timer.current)
    setState({ kind: 'loading' })
    try {
      const res = await explainLesson({ data: { leconId, niveau: n } })
      if (res.status === 'ready')
        setState({ kind: 'ready', explication: res.explication })
      else if (tries > 75)
        setState({
          kind: 'error',
          message:
            'Le Professeur IA met plus de temps que prévu. Réessaie dans quelques minutes.',
        })
      else timer.current = window.setTimeout(() => void run(n, tries + 1), 4000)
    } catch (e) {
      setState({
        kind: 'error',
        message:
          e instanceof Error && e.message
            ? e.message
            : 'Explication indisponible. Réessaie.',
      })
    }
  }

  return (
    <section
      aria-labelledby="explique-moi"
      className="rounded-2xl border border-secondary/40 bg-card p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="explique-moi"
          className="inline-flex items-center gap-2 font-display text-xl font-extrabold"
        >
          <Sparkles className="size-5 text-secondary" aria-hidden="true" />
          Explique-moi cette leçon
        </h2>
        <ExempleBadge />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Le Professeur IA te réexplique tout le chapitre, pas à pas. Choisis la
        profondeur :
      </p>
      <div
        role="radiogroup"
        aria-label="Niveau d’explication"
        className="mt-4 grid gap-2 sm:grid-cols-3"
      >
        {NIVEAUX_EXPLICATION.map((n) => {
          const info = EXPLICATION_INFO[n]
          const open = ouverts.includes(n)
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={niveau === n}
              onClick={() => {
                setNiveau(n)
                if (timer.current) window.clearTimeout(timer.current)
                setState({ kind: 'idle' })
              }}
              className={cn(
                'min-h-11 rounded-xl border border-border px-3 py-2 text-left text-sm',
                niveau === n && 'border-primary bg-primary/10',
              )}
            >
              <span className="flex items-center gap-1.5 font-bold">
                {!open && <Lock className="size-3.5" aria-hidden="true" />}
                {info.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {open ? 'Inclus dans ta formule' : `Formule ${info.formule}`}
              </span>
            </button>
          )
        })}
      </div>

      {locked ? (
        <div className="mt-4 rounded-xl border-2 border-dashed border-primary/60 bg-primary/5 p-4 text-sm">
          <p className="font-semibold">
            La version {EXPLICATION_INFO[niveau].label} contient :
          </p>
          <ul className="mt-2 space-y-1">
            {EXPLICATION_INFO[niveau].contenu.map((c) => (
              <li key={c} className="flex gap-2">
                <Crown
                  className="mt-0.5 size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                {c}
              </li>
            ))}
          </ul>
          <Link
            to="/premium"
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 font-bold text-primary-foreground"
          >
            <Crown className="size-4" aria-hidden="true" /> Débloquer avec{' '}
            {EXPLICATION_INFO[niveau].formule}
          </Link>
        </div>
      ) : state.kind === 'ready' ? (
        <>
          <ExplanationView explication={state.explication} />
          {plan !== 'trimestriel' && (
            <p className="mt-5 rounded-xl bg-primary/10 p-3 text-sm">
              Envie d’aller plus loin ?{' '}
              <Link to="/premium" className="font-bold underline">
                La version{' '}
                {plan === 'gratuit' ? 'Détaillée' : 'Approfondie'} ajoute{' '}
                {plan === 'gratuit'
                  ? 'des exemples résolus, les erreurs fréquentes et des exercices corrigés'
                  : 'la méthode d’examen, un sujet type corrigé et des défis'}
                .
              </Link>
            </p>
          )}
        </>
      ) : (
        <div className="mt-4 space-y-3">
          <Button
            className="min-h-11 rounded-full px-5 font-bold"
            disabled={state.kind === 'loading'}
            onClick={() => void run(niveau)}
          >
            {state.kind === 'loading' ? (
              <>
                <Loader2
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
                Le Professeur IA prépare ton explication…
              </>
            ) : (
              <>
                <BookOpenCheck className="size-4" aria-hidden="true" />
                Explique-moi ({EXPLICATION_INFO[niveau].label})
              </>
            )}
          </Button>
          {state.kind === 'loading' && (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              La première fois, la rédaction peut prendre une à deux minutes.
              Elle sera ensuite immédiate pour toute ta classe.
            </p>
          )}
          {state.kind === 'error' && (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          )}
        </div>
      )}
    </section>
  )
}

function ExplanationView({ explication: x }: { explication: Explication }) {
  const [shown, setShown] = useState<Record<string, boolean>>({})
  const toggle = (k: string) => setShown((s) => ({ ...s, [k]: !s[k] }))
  return (
    <article className="mt-5 space-y-5 leading-relaxed" aria-live="polite">
      <header>
        <h3 className="font-display text-2xl font-extrabold">{x.titre}</h3>
        <p className="mt-1 text-muted-foreground">{x.accroche}</p>
      </header>
      {x.sections.map((s) => (
        <section key={s.titre}>
          <h4 className="font-display text-lg font-bold">{s.titre}</h4>
          <div className="mt-1 space-y-2">
            {s.paragraphes.map((p) => (
              <p key={p} className="whitespace-pre-line">
                {p}
              </p>
            ))}
          </div>
        </section>
      ))}
      {x.exemples.length > 0 && (
        <section>
          <h4 className="font-display text-lg font-bold">Exemples résolus</h4>
          <ol className="mt-2 space-y-3">
            {x.exemples.map((e, i) => (
              <li
                key={e.enonce}
                className="rounded-xl border border-border bg-background p-4"
              >
                <p className="font-semibold">
                  Exemple {i + 1} · {e.enonce}
                </p>
                <p className="mt-2 whitespace-pre-line text-sm">{e.corrige}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
      {x.erreurs.length > 0 && (
        <section>
          <h4 className="font-display text-lg font-bold">
            Erreurs fréquentes
          </h4>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {x.erreurs.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </section>
      )}
      {x.methode.length > 0 && (
        <section>
          <h4 className="font-display text-lg font-bold">
            Méthode pour l’examen
          </h4>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {x.methode.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </section>
      )}
      {x.exercices.length > 0 && (
        <section>
          <h4 className="font-display text-lg font-bold">
            À toi de jouer
          </h4>
          <ol className="mt-2 space-y-3">
            {x.exercices.map((e, i) => {
              const k = `ex-${i}`
              return (
                <li
                  key={e.enonce}
                  className="paper-lined rounded-xl border border-border p-4"
                >
                  <p className="font-semibold">
                    Exercice {i + 1} · {e.enonce}
                  </p>
                  {e.indice && (
                    <details className="mt-2 text-sm">
                      <summary className="min-h-11 cursor-pointer content-center font-semibold text-secondary">
                        Voir l’indice
                      </summary>
                      <p className="whitespace-pre-line">{e.indice}</p>
                    </details>
                  )}
                  <Button
                    variant="outline"
                    className="mt-2 min-h-11 rounded-full"
                    aria-expanded={!!shown[k]}
                    onClick={() => toggle(k)}
                  >
                    {shown[k] ? 'Masquer le corrigé' : 'Voir le corrigé'}
                  </Button>
                  {shown[k] && (
                    <p className="mt-2 whitespace-pre-line text-sm">
                      {e.corrige}
                    </p>
                  )}
                </li>
              )
            })}
          </ol>
        </section>
      )}
      <section className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4">
        <h4 className="font-display text-lg font-bold">Fiche mémo</h4>
        <ul className="mt-2 space-y-1 font-mono text-sm">
          {x.memo.map((m) => (
            <li key={m}>• {m}</li>
          ))}
        </ul>
      </section>
    </article>
  )
}
