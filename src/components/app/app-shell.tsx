import { Link, useRouterState, useLoaderData } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Access } from '@/lib/access'
import { BLOCAGE_EXPLICATION, formatFinAcces } from '@/lib/access'
import { useNow } from '@/hooks/use-now'
import { useActivityBeat } from '@/hooks/use-activity-beat'
import { AnnouncementBanner } from '@/components/app/student-extras'
import {
  FreeOfferNotice,
  TrialOfferStrip,
} from '@/components/app/free-offer-notice'
import {
  BookOpen,
  Compass,
  Crown,
  House,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { Logo } from './brand'
import { TimeIndicator } from './time-indicator'
import { cn } from '@/lib/utils'
import { FREE_MINUTES_PER_DAY } from '@/lib/config'

const TABS = [
  { to: '/accueil', label: 'Accueil', icon: House },
  { to: '/explorer', label: 'Explorer', icon: Compass },
  { to: '/lecons', label: 'Leçons', icon: BookOpen },
  { to: '/ia', label: 'IA', icon: Sparkles },
  { to: '/profil', label: 'Profil', icon: UserRound },
] as const

export function AppShell({ children }: { children: React.ReactNode }) {
  const billing = useLoaderData({ from: '/_app' })
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const access = useLiveAccess(billing?.access ?? null)

  return (
    <div className="min-h-svh bg-background pb-24 md:pb-10">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-3 px-4 sm:px-6">
          <Logo />
          <nav
            aria-label="Navigation principale"
            className="hidden items-center gap-1 md:flex"
          >
            {TABS.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none',
                  pathname.startsWith(t.to) &&
                    'bg-ink text-ink-foreground hover:text-ink-foreground',
                )}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <TimeIndicator access={access} />
            <Link
              to="/premium"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              <Crown className="size-4" aria-hidden="true" />
              Premium
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-content px-4 py-6 sm:px-6">
        <AccessGuard access={access} />
        <AnnouncementBanner announcement={billing?.announcement} />
        <AccessReminder access={access} />
        <TrialOfferStrip access={access} />
        <FreeOfferNotice access={access} />
        {children}
      </main>

      <nav
        aria-label="Onglets"
        className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur md:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {TABS.map((t) => {
            const active = pathname.startsWith(t.to)
            const Icon = t.icon
            return (
              <li key={t.to}>
                <Link
                  to={t.to}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-semibold text-muted-foreground',
                    active && 'text-primary',
                  )}
                >
                  <span
                    className={cn(
                      'grid h-7 w-12 place-items-center rounded-full',
                      active && 'bg-primary/15',
                    )}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  {t.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}

/**
 * Accès tenu à jour par le battement d'activité (forfait gratuit) : avertissements à 10 et 3 minutes,
 * puis renvoi vers /premium?raison=temps dès que le serveur indique que le temps du jour est épuisé.
 */
function useLiveAccess(initial: Access | null) {
  // Accès renvoyé par le dernier battement, valable tant que le chargement serveur n'a pas changé.
  const [live, setLive] = useState<{ from: Access | null; access: Access } | null>(null)
  const access = live && live.from === initial ? live.access : initial
  const initialRef = useRef(initial)
  useEffect(() => {
    initialRef.current = initial
  }, [initial])
  const warned = useRef(new Set<number>())
  const onAccess = useCallback((next: Access | null) => {
    if (!next) return
    setLive({ from: initialRef.current, access: next })
    if (next.status !== 'gratuit') return
    for (const seuil of [10, 3])
      if (next.secondesRestantes <= seuil * 60 && !warned.current.has(seuil)) {
        warned.current.add(seuil)
        toast.warning(
          `Plus que ${Math.max(1, Math.ceil(next.secondesRestantes / 60))} minutes gratuites aujourd’hui.`,
          {
            description:
              'Passe Premium pour réviser sans limite de temps (dès 1 500 FCFA par mois).',
          },
        )
      }
  }, [])
  useActivityBeat(onAccess)
  return access
}

/** Temps du jour épuisé ou fin d'essai pendant que la page est ouverte (le serveur bloque déjà tout). */
function AccessGuard({ access }: { access?: Access | null }) {
  useEffect(() => {
    if (!access) return
    if (access.status === 'bloque') {
      window.location.assign('/premium?raison=temps')
      return
    }
    if (access.status !== 'essai') return
    const wait = Date.parse(access.until) - Date.now()
    // Fin de l'essai : la page se recharge et passe au forfait gratuit.
    const go = () => window.location.reload()
    if (wait <= 0) return
    // setTimeout est limité à ~24,8 jours ; l'essai dure 3 jours.
    const t = window.setTimeout(go, Math.min(wait + 1000, 2 ** 31 - 1))
    return () => window.clearTimeout(t)
  }, [access])
  return null
}

/** Rappel avant la fin de l'essai (J-2, J-1) ou de l'abonnement (J-3, J-1). */
function AccessReminder({ access }: { access?: Access | null }) {
  const now = useNow(60_000)
  if (!now || !access || access.status === 'bloque') return null
  if (access.status === 'gratuit') return <FreePlanBar access={access} />
  const days = Math.ceil((Date.parse(access.until) - now.getTime()) / 86_400_000)
  const seuil = access.status === 'essai' ? 2 : 3
  if (Number.isNaN(days) || days > seuil) return null
  return (
    <div
      role="status"
      className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/50 bg-primary/10 p-4 text-sm"
    >
      <p>
        <strong>
          {access.status === 'essai'
            ? days <= 1
              ? `Dernier jour d’essai gratuit : il se termine le ${formatFinAcces(access.until)}.`
              : `Plus que ${days} jours d’essai gratuit : il se termine le ${formatFinAcces(access.until)}.`
            : days <= 1
              ? 'Ton Premium se termine demain.'
              : `Ton Premium se termine dans ${days} jours.`}
        </strong>{' '}
        {access.status === 'essai'
          ? `Ensuite, tu passes au forfait gratuit : ${FREE_MINUTES_PER_DAY} minutes par jour, sans oral, sans niveaux 3–4 et avec l’explication courte seulement. ${BLOCAGE_EXPLICATION} `
          : 'Ensuite, tu reviens au forfait gratuit limité. '}
        Prends Premium maintenant : les jours restants ne sont jamais perdus.
      </p>
      <Link
        to="/premium"
        className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 font-bold text-primary-foreground"
      >
        Choisir une offre
      </Link>
    </div>
  )
}

/** Forfait gratuit : temps restant aujourd'hui et rappel de ce que Premium débloque. */
function FreePlanBar({
  access,
}: {
  access: Extract<Access, { status: 'gratuit' }>
}) {
  const minutes = Math.max(0, Math.ceil(access.secondesRestantes / 60))
  const pct = Math.round(
    (access.secondesRestantes / (access.minutesParJour * 60)) * 100,
  )
  return (
    <div className="mb-5 rounded-2xl border border-border bg-card p-4 text-sm shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>
          <strong>
            Forfait gratuit{access.offert ? ' offert' : ''} · {minutes} min
            restante{minutes > 1 ? 's' : ''} aujourd’hui
          </strong>{' '}
          <span className="text-muted-foreground">
            sur {access.minutesParJour} min/jour. Le compteur se met en pause
            quand tu ne fais rien. Une fois ce temps fini, seule la page de
            paiement reste ouverte jusqu’à minuit.
          </span>
        </p>
        <Link
          to="/premium"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 font-bold text-primary-foreground"
        >
          <Crown className="size-4" aria-hidden="true" /> Réviser sans limite
        </Link>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Temps gratuit restant aujourd’hui"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            'h-full rounded-full bg-secondary transition-[width] motion-reduce:transition-none',
            pct <= 33 && 'bg-primary',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
