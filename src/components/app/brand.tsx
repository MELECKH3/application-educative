import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn('inline-flex items-center gap-2 font-display text-xl font-extrabold tracking-tight', className)}
      aria-label="Annales+, retour à la page d’accueil"
    >
      <span
        aria-hidden="true"
        className="grid size-9 place-items-center rounded-xl bg-primary text-lg text-primary-foreground shadow-sm"
      >
        A+
      </span>
      <span>
        Annales<span className="text-primary">+</span>
      </span>
    </Link>
  )
}

export function ExempleBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md bg-exemple px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wider text-exemple-foreground',
        className,
      )}
      title="Sujet d’entraînement généré — ce n’est pas une épreuve officielle"
    >
      Exemple
    </span>
  )
}

const LEVEL_STYLES = [
  'bg-secondary/15 text-secondary',
  'bg-primary/15 text-accent-foreground',
  'bg-chart-3/15 text-chart-3',
  'bg-destructive/15 text-destructive',
]

export function LevelPill({ niveau }: { niveau: 1 | 2 | 3 | 4 }) {
  const labels = ['Fondations', 'Standard examen', 'Approfondissement', 'Olympiades']
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', LEVEL_STYLES[niveau - 1])}>
      Niv. {niveau} · {labels[niveau - 1]}
    </span>
  )
}
