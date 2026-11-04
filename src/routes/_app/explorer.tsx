import { useStudent } from '@/hooks/use-student'
import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'
import { Crown } from 'lucide-react'
import { ExempleBadge, LevelPill } from '@/components/app/brand'
import { cn } from '@/lib/utils'
import { getClassSujets } from '@/lib/sujets.functions'
import { PreparingNotice } from '@/components/app/preparing-notice'
import { LEVELS } from '@/lib/config'

const searchSchema = z.object({
  matiere: z.string().optional(),
  niveau: z.coerce.number().int().min(1).max(4).optional().catch(undefined),
  page: z.coerce.number().int().min(0).max(1000).optional().catch(undefined),
})

export const Route = createFileRoute('/_app/explorer')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    getClassSujets({
      data: {
        matiere: deps.matiere,
        niveau: deps.niveau,
        page: deps.page ?? 0,
      },
    }),
  head: () => ({
    meta: [
      { title: 'Explorer les sujets — Annales+' },
      {
        name: 'description',
        content:
          'Sujets par classe, série, matière et niveau : Fondations, Standard examen, Approfondissement, Olympiades.',
      },
      { property: 'og:title', content: 'Explorer les sujets — Annales+' },
      {
        property: 'og:description',
        content: 'Trouve le sujet qui correspond à ton niveau.',
      },
    ],
  }),
  component: Explorer,
})

function Explorer() {
  const { matiere, niveau, page = 0 } = Route.useSearch()
  const s = useStudent()
  const data = Route.useLoaderData()
  const matieres = data.matieres
  const list = [...data.sujets].sort(
    (a, b) =>
      Number(b.niveau === s.niveauPrefere) -
      Number(a.niveau === s.niveauPrefere),
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold">
          Explorer les sujets
        </h1>
        <p className="text-muted-foreground">
          {s.classe} {s.serie} · {s.pays} · {data.totalClasse} sujet
          {data.totalClasse > 1 ? 's' : ''} pour ta classe
        </p>
      </div>
      <PreparingNotice
        preparing={data.preparing}
        classe={s.classe}
        matiere={matieres.find((m) => m.id === matiere)?.nom}
      />

      <div className="space-y-3">
        <FilterRow label="Matière">
          <Chip active={!matiere} to={{ matiere: undefined, niveau }}>
            Toutes
          </Chip>
          {matieres.map((m) => (
            <Chip
              key={m.id}
              active={matiere === m.id}
              to={{ matiere: m.id, niveau }}
            >
              <span aria-hidden="true">{m.emoji}</span> {m.nom}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="Niveau">
          <Chip active={!niveau} to={{ matiere, niveau: undefined }}>
            Tous
          </Chip>
          {LEVELS.map((l) => (
            <Chip
              key={l.n}
              active={niveau === l.n}
              to={{ matiere, niveau: l.n }}
            >
              {l.n}. {l.label}
              {l.n === s.niveauPrefere && (
                <span className="ml-1 text-xs opacity-75">(préféré)</span>
              )}
            </Chip>
          ))}
        </FilterRow>
      </div>

      <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        Les sujets marqués <ExempleBadge className="align-middle" /> sont des
        sujets d’entraînement originaux, pas des épreuves officielles.
      </p>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <p className="font-display text-lg font-bold">
            {data.preparing
              ? 'Tes sujets arrivent'
              : 'Aucun sujet pour ce filtre pour l’instant'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Essaie un autre niveau ou une autre matière, ou demande au tuteur un
            exercice adapté à ta classe.
          </p>
          <Link
            to="/ia"
            search={{ mode: 'Exercice similaire' }}
            className="mt-4 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground"
          >
            Demander un exercice au tuteur IA
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {list.map((x) => {
            const m = matieres.find((mm) => mm.id === x.matiere)
            return (
              <li key={x.id}>
                <Link
                  to="/sujets/$sujetId"
                  params={{ sujetId: x.id }}
                  className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-sm hover:border-primary"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-muted-foreground">
                      <span aria-hidden="true">{m?.emoji}</span> {m?.nom} ·{' '}
                      {x.chapitre}
                    </span>
                    <ExempleBadge />
                  </div>
                  <h2 className="mt-2 text-lg leading-snug">{x.titre}</h2>
                  {x.verrouille && (
                    <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-bold text-foreground">
                      <Crown className="size-3.5" aria-hidden="true" /> Premium
                    </span>
                  )}
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
      )}
      {(page > 0 || data.hasMore) && (
        <nav
          aria-label="Pages de sujets"
          className="flex justify-between gap-3"
        >
          {page > 0 ? (
            <Link
              from="/explorer"
              search={{ matiere, niveau, page: page - 1 || undefined }}
              className="inline-flex min-h-11 items-center rounded-full border border-border px-5 text-sm font-semibold"
            >
              ← Plus récents
            </Link>
          ) : (
            <span />
          )}
          {data.hasMore && (
            <Link
              from="/explorer"
              search={{ matiere, niveau, page: page + 1 }}
              className="inline-flex min-h-11 items-center rounded-full border border-border px-5 text-sm font-semibold"
            >
              Plus anciens →
            </Link>
          )}
        </nav>
      )}
    </div>
  )
}

function FilterRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
    >
      {children}
    </div>
  )
}

function Chip({
  active,
  to,
  children,
}: {
  active: boolean
  to: { matiere?: string; niveau?: number; page?: number }
  children: React.ReactNode
}) {
  return (
    <Link
      from="/explorer"
      search={to}
      aria-pressed={active}
      className={cn(
        'inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border border-border bg-card px-4 text-sm font-semibold',
        active && 'border-ink bg-ink text-ink-foreground',
      )}
    >
      {children}
    </Link>
  )
}
