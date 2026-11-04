import { Link } from '@tanstack/react-router'
import { Crown, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Fonction réservée à Premium : explique ce qu'elle apporte et mène aux offres. */
export function PremiumLockCard({
  titre,
  texte,
  points,
  className,
}: {
  titre: string
  texte: string
  points?: string[]
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border-2 border-dashed border-primary/60 bg-primary/5 p-6',
        className,
      )}
    >
      <p className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
        <Lock className="size-3.5" aria-hidden="true" /> Réservé à Premium
      </p>
      <h2 className="mt-3 font-display text-xl font-extrabold">{titre}</h2>
      <p className="mt-2 text-sm leading-relaxed">{texte}</p>
      {points && points.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {points.map((p) => (
            <li key={p} className="flex gap-2">
              <Crown className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              {p}
            </li>
          ))}
        </ul>
      )}
      <Link
        to="/premium"
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
      >
        <Crown className="size-4" aria-hidden="true" /> Débloquer avec Premium
      </Link>
    </section>
  )
}
