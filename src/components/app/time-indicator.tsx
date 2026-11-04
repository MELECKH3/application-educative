import { Clock, Star } from 'lucide-react'
import { formatBillingDate } from '@/lib/billing'
import { VIP_WELCOME_DAYS } from '@/lib/config'
import type { Access } from '@/lib/access'

/** Indicateur d'accès, calculé par le serveur : Premium, jours d'essai ou minutes gratuites restantes. */
export function TimeIndicator({ access }: { access?: Access | null }) {
  if (!access || access.status === 'bloque') return null
  if (access.status === 'abonne')
    return (
      <span
        role="status"
        className="hidden min-h-11 items-center gap-1.5 rounded-full border border-secondary/40 bg-secondary/10 px-3 text-xs font-semibold text-secondary sm:inline-flex"
      >
        <Star className="size-3.5" aria-hidden="true" />
        Premium · jusqu’au {formatBillingDate(access.until)}
      </span>
    )
  if (access.status === 'gratuit') {
    const min = Math.max(0, Math.ceil(access.secondesRestantes / 60))
    return (
      <span
        role="status"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold"
        aria-label={`Forfait gratuit : ${min} minute(s) restante(s) aujourd’hui sur ${access.minutesParJour}`}
      >
        <Clock className="size-3.5" aria-hidden="true" />
        {min} min
      </span>
    )
  }
  return (
    <span
      role="status"
      className="hidden min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold sm:inline-flex"
      aria-label={`Essai gratuit : ${access.joursRestants} jour(s) restant(s) sur ${VIP_WELCOME_DAYS}`}
    >
      <Clock className="size-3.5" aria-hidden="true" />
      Essai gratuit · {access.joursRestants} j restant
      {access.joursRestants > 1 ? 's' : ''}
    </span>
  )
}
