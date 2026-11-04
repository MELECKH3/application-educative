import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Check, Crown } from 'lucide-react'
import type { Access } from '@/lib/access'
import { BLOCAGE_EXPLICATION, LIMITES, formatFinAcces } from '@/lib/access'
import {
  FREE_MINUTES_PER_DAY,
  OFFERS,
  VIP_WELCOME_DAYS,
  formatFcfa,
} from '@/lib/config'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const SEEN_KEY = 'annales-offre-gratuite-vue'
const cheapest = Math.min(...OFFERS.map((o) => o.price))
const best = OFFERS.find((o) => o.best) ?? OFFERS[OFFERS.length - 1]

type FreeAccess = Extract<Access, { status: 'essai' | 'gratuit' }>
const isFree = (a: Access | null | undefined): a is FreeAccess =>
  a?.status === 'essai' || a?.status === 'gratuit'

/** Ce que l'offre gratuite permet, d'après les limites réellement appliquées par le serveur. */
export function freePlanSummary(minutesParJour: number) {
  const g = LIMITES.gratuit
  return `${minutesParJour} min par jour, ${g.messagesIaParJour} messages IA, ${g.nouvellesLeconsParJour} nouvelle leçon par jour, niveaux ${g.niveaux.join(' et ')}, sans oral`
}

export const PREMIUM_PERKS = [
  'Révise sans limite de temps, tous les jours',
  'Simulateur d’oral et sujets de niveaux 3 et 4',
  `Jusqu’à ${LIMITES.premium.messagesIaParJour} messages au Professeur IA par jour`,
  `${LIMITES.premium.nouvellesLeconsParJour} nouvelles leçons et ${LIMITES.premium.explicationsParJour} explications détaillées par jour`,
]

/**
 * Rappel répété à chaque ouverture de l'application (une fois par session) pour les élèves
 * en essai ou au forfait gratuit : ils sont dans l'offre gratuite, et Premium est meilleur.
 */
export function FreeOfferNotice({ access }: { access?: Access | null }) {
  const [open, setOpen] = useState(false)
  const free = isFree(access)
  useEffect(() => {
    if (!free) return
    try {
      if (sessionStorage.getItem(SEEN_KEY)) return
      sessionStorage.setItem(SEEN_KEY, '1')
    } catch {
      // Stockage indisponible : on affiche quand même le rappel.
    }
    const t = window.setTimeout(() => setOpen(true), 1200)
    return () => window.clearTimeout(t)
  }, [free])
  if (!isFree(access)) return null

  const minutes =
    access.status === 'gratuit' ? access.minutesParJour : undefined
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Tu es dans l’offre gratuite
          </DialogTitle>
          <DialogDescription>
            {access.status === 'essai'
              ? `Pendant ton essai gratuit de ${VIP_WELCOME_DAYS} jours, tout est ouvert (encore ${access.joursRestants} jour${access.joursRestants > 1 ? 's' : ''}). Ensuite, l’offre gratuite est limitée : ${freePlanSummary(FREE_MINUTES_PER_DAY)}.`
              : `L’offre gratuite est limitée : ${freePlanSummary(minutes ?? FREE_MINUTES_PER_DAY)}.`}
          </DialogDescription>
        </DialogHeader>
        {access.status === 'essai' && (
          <p className="rounded-2xl border border-border bg-muted/50 p-3 text-sm">
            <strong>Ton essai gratuit se termine le {formatFinAcces(access.until)}</strong>{' '}
            (heure d’Abidjan).
          </p>
        )}
        <p className="text-sm font-semibold">{BLOCAGE_EXPLICATION}</p>
        <div className="rounded-2xl border-2 border-primary/50 bg-primary/5 p-4">
          <p className="flex items-center gap-2 font-display text-lg font-bold">
            <Crown className="size-5 text-primary" aria-hidden="true" />
            Il existe une offre payante bien meilleure
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {PREMIUM_PERKS.map((p) => (
              <li key={p} className="flex gap-2">
                <Check
                  className="mt-0.5 size-4 shrink-0 text-secondary"
                  aria-hidden="true"
                />
                {p}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm font-semibold">
            Dès {formatFcfa(cheapest)} par mois — ou {formatFcfa(best.price)}{' '}
            pour {best.durationLabel}, par Wave ou Orange Money.
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="min-h-11 rounded-full border border-border px-5 font-semibold"
          >
            Continuer en gratuit
          </button>
          <Link
            to="/premium"
            onClick={() => setOpen(false)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 font-bold text-primary-foreground"
          >
            <Crown className="size-4" aria-hidden="true" /> Voir l’offre Premium
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Bandeau permanent pendant l'essai : rappelle qu'il s'agit de l'offre gratuite. */
export function TrialOfferStrip({ access }: { access?: Access | null }) {
  // Les deux derniers jours, le rappel de fin d'essai prend le relais.
  if (access?.status !== 'essai' || access.joursRestants <= 2) return null
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 text-sm shadow-sm">
      <p>
        <strong>Tu es dans l’offre gratuite</strong> (essai de{' '}
        {VIP_WELCOME_DAYS} jours, jusqu’au {formatFinAcces(access.until)}).{' '}
        Ensuite : {FREE_MINUTES_PER_DAY} min par jour, puis seule la page de
        paiement reste ouverte une fois ce temps fini.{' '}
        <span className="text-muted-foreground">
          L’offre Premium est meilleure : sans limite de temps, dès{' '}
          {formatFcfa(cheapest)} par mois.
        </span>
      </p>
      <Link
        to="/premium"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 font-bold text-primary-foreground"
      >
        <Crown className="size-4" aria-hidden="true" /> Voir Premium
      </Link>
    </div>
  )
}
