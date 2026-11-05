import {
  ADMIN_FREE_MINUTES_PER_DAY,
  FREE_MINUTES_PER_DAY,
  VIP_WELCOME_DAYS,
} from './config'

// Accès à l'application, toujours calculé par le serveur (horloge de la base) :
// - 3 jours d'essai complet à l'inscription ;
// - puis forfait gratuit limité : 40 min/jour pour chaque élève qui ne paie pas ;
// - temps du jour épuisé = blocage jusqu'à minuit (Abidjan = UTC) ou jusqu'au paiement ;
// - abonnement Premium actif = illimité.

export type Access =
  | { status: 'abonne'; until: string; offerId: string }
  | { status: 'essai'; until: string; joursRestants: number }
  | {
      status: 'gratuit'
      minutesParJour: number
      /** Forfait 40 min activé par l'administrateur. */
      offert: boolean
      secondesRestantes: number
      reprise: string
    }
  | {
      status: 'bloque'
      minutesParJour: number
      offert: boolean
      /** Retour du temps gratuit (minuit, heure d'Abidjan). */
      reprise: string
    }

const DAY = 24 * 3600 * 1000

export type FreeUsage = {
  /** Minutes accordées par l'admin (forfait 40 min) ; null = forfait standard. */
  minutesOffertes: number | null
  /** Secondes d'utilisation comptées aujourd'hui. */
  secondesUtilisees: number
}

const nextMidnight = (now: Date) =>
  new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  )

export function accessFrom(
  profileCreatedAt: Date,
  subscription: { expiresAt: Date; offerId: string } | null,
  now: Date,
  usage: FreeUsage = { minutesOffertes: null, secondesUtilisees: 0 },
): Access {
  if (subscription && subscription.expiresAt.getTime() > now.getTime())
    return {
      status: 'abonne',
      until: subscription.expiresAt.toISOString(),
      offerId: subscription.offerId,
    }
  const fin = new Date(profileCreatedAt.getTime() + VIP_WELCOME_DAYS * DAY)
  if (fin.getTime() > now.getTime())
    return {
      status: 'essai',
      until: fin.toISOString(),
      joursRestants: Math.max(
        1,
        Math.ceil((fin.getTime() - now.getTime()) / DAY),
      ),
    }
  const offert = usage.minutesOffertes != null
  const minutesParJour = offert
    ? ADMIN_FREE_MINUTES_PER_DAY
    : FREE_MINUTES_PER_DAY
  const restantes = Math.max(
    0,
    minutesParJour * 60 - Math.max(0, usage.secondesUtilisees),
  )
  const reprise = nextMidnight(now).toISOString()
  if (restantes <= 0)
    return { status: 'bloque', minutesParJour, offert, reprise }
  return {
    status: 'gratuit',
    minutesParJour,
    offert,
    secondesRestantes: restantes,
    reprise,
  }
}

/** Formule de l'élève : tout est ouvert pendant l'essai et l'abonnement, limité sinon. */
export type Plan = 'gratuit' | 'mensuel' | 'trimestriel'
export function planOf(access: Access | null | undefined): Plan {
  if (!access) return 'gratuit'
  if (access.status === 'essai') return 'trimestriel'
  if (access.status === 'abonne')
    return access.offerId === 'mensuel' ? 'mensuel' : 'trimestriel'
  return 'gratuit'
}
export const isPremium = (access: Access | null | undefined) =>
  planOf(access) !== 'gratuit'

/** Limites du forfait gratuit (le reste de l'application est illimité en Premium). */
export const LIMITES = {
  gratuit: {
    messagesIaParJour: 15,
    nouvellesLeconsParJour: 1,
    explicationsParJour: 3,
    niveaux: [1, 2] as number[],
    oral: false,
  },
  premium: {
    messagesIaParJour: 300,
    nouvellesLeconsParJour: 5,
    explicationsParJour: 40,
    niveaux: [1, 2, 3, 4] as number[],
    oral: true,
  },
} as const
export const limitesFor = (access: Access | null | undefined) =>
  isPremium(access) ? LIMITES.premium : LIMITES.gratuit

export const ACCESS_BLOCKED_MESSAGE =
  'Ton temps gratuit d’aujourd’hui est terminé. Il revient à minuit, ou passe Premium pour continuer sans limite.'

export const PREMIUM_ONLY_MESSAGE =
  'Cette fonction est réservée aux abonnés Premium. Choisis une offre pour la débloquer.'

/** Date de fin lisible, heure d'Abidjan (UTC+0) : « mercredi 11 novembre 2026 à 14:30 ». */
export const formatFinAcces = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const jour = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d)
  const heure = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(d)
  return `${jour} à ${heure}`
}

/** Ce qui arrive quand l'élève n'a pas payé : seule la page de paiement reste ouverte. */
export const BLOCAGE_EXPLICATION =
  'Sans paiement, quand ton temps gratuit du jour est fini, l’application se ferme : seule la page de paiement reste ouverte jusqu’à minuit.'
