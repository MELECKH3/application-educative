import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { ArrowLeft, Lock, Sparkles, Timer } from 'lucide-react'
import { ExempleBadge, LevelPill } from '@/components/app/brand'
import { Button } from '@/components/ui/button'
import { matiereById } from '@/lib/curriculum'
import { getSujet } from '@/lib/sujets.functions'
import { ReportSubjectButton } from '@/components/app/student-extras'
import { PremiumLockCard } from '@/components/app/premium-lock'

export const Route = createFileRoute('/_app/sujets/$sujetId')({
  loader: async ({ params }) => {
    const sujet = await getSujet({ data: { id: params.sujetId } })
    if (!sujet) throw notFound()
    return { sujet }
  },
  head: ({ loaderData }) => {
    const t = loaderData
      ? `${loaderData.sujet.titre} — Annales+`
      : 'Sujet — Annales+'
    const d =
      'Sujet d’entraînement Annales+ avec barème, tuteur IA et examen chronométré.'
    return {
      meta: [
        { title: t },
        { name: 'description', content: d },
        { property: 'og:title', content: t },
        { property: 'og:description', content: d },
      ],
    }
  },
  component: SujetPage,
})

function SujetPage() {
  const { sujet } = Route.useLoaderData()
  const m = matiereById(sujet.matiere)

  return (
    <article className="mx-auto max-w-reading space-y-6">
      <Link
        to="/explorer"
        className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Retour aux sujets
      </Link>
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <ExempleBadge />
          <LevelPill niveau={sujet.niveau} />
          <span className="text-sm text-muted-foreground">
            {sujet.classe} {sujet.serie} · {m?.nom} · {sujet.dureeMin} min
          </span>
        </div>
        <h1 className="font-display text-3xl font-extrabold leading-tight">
          {sujet.titre}
        </h1>
        <p className="text-sm text-muted-foreground">
          Chapitre : {sujet.chapitre}
        </p>
      </header>

      {sujet.verrouille ? (
        <PremiumLockCard
          titre="Sujet de niveau Premium"
          texte={`Les niveaux 3 (Approfondissement) et 4 (Olympiades) sont réservés à Premium : énoncé complet, épreuve chronométrée et travail avec le tuteur IA. Ils font la différence le jour de l’examen.`}
        />
      ) : (
      <>
      <section
        aria-labelledby="enonce"
        className="rounded-2xl border border-border bg-card p-6 shadow-sm"
      >
        <h2 id="enonce" className="text-lg">
          Énoncé
        </h2>
        <div className="mt-3 space-y-3 whitespace-pre-line leading-relaxed">
          {sujet.enonce}
        </div>
        <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Barème :</span>{' '}
          {sujet.bareme}
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          asChild
          size="lg"
          className="min-h-12 rounded-full text-base font-bold"
        >
          <Link to="/examen/$sujetId" params={{ sujetId: sujet.id }}>
            <Timer className="size-5" aria-hidden="true" /> Commencer l’épreuve
          </Link>
        </Button>
        <Button
          asChild
          size="lg"
          variant="outline"
          className="min-h-12 rounded-full text-base font-semibold"
        >
          <Link to="/ia" search={{ sujet: sujet.id }}>
            <Sparkles className="size-5" aria-hidden="true" /> Travailler avec
            le tuteur
          </Link>
        </Button>
      </div>

      <p className="flex items-start gap-2 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Le corrigé détaillé s’ouvre après l’épreuve, 10 minutes après avoir
        rendu ta copie.
      </p>
      </>
      )}
      <ReportSubjectButton subjectId={sujet.id} />
    </article>
  )
}
