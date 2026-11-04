// Valeurs officielles d'Annales+ (prix, durées, coordonnées). Ce ne sont PAS des données d'aperçu :
// elles seront réutilisées telles quelles par le serveur dans les prochaines étapes.

export const WAVE_NUMBER = '0712600858'
export const WHATSAPP_URL = 'https://wa.me/2250712600858'
export const WHATSAPP_DISPLAY = '07 12 60 08 58'
export const ADMIN_EMAIL = 'tablechaisse926@gmail.com'

/** Forfait gratuit standard (sans intervention de l'admin) : 30 min/jour, fonctions limitées. */
export const FREE_MINUTES_PER_DAY = 30
/** Forfait gratuit élargi : 40 min/jour, activable uniquement par l'administrateur pour un élève. */
export const ADMIN_FREE_MINUTES_PER_DAY = 40
/** Bénéficiaire qui doit figurer sur chaque reçu Wave / Orange Money. */
export const RECEIPT_NAMES = ['Adou Melchi', 'Adou Meleckh'] as const
export const VIP_WELCOME_DAYS = 3
export const EXAM_SAS_MINUTES = 10
export const REFRESH_EVERY_DAYS = 1

export type Offer = {
  id: 'mensuel' | 'trimestriel'
  label: string
  price: number
  days: number
  durationLabel: string
  orangeMoneyUrl: string
  best?: boolean
}

export const OFFERS: Offer[] = [
  {
    id: 'mensuel',
    label: 'Mensuel',
    price: 1500,
    days: 30,
    durationLabel: '1 mois',
    orangeMoneyUrl:
      'https://multi.app.orange-money.com/app/v1/kapptivate/qrcode/odyssee/?id=codgen1-e0ef6d8de7c7423097ba720d0b5738ab&v=1&amount=1500',
  },
  {
    id: 'trimestriel',
    label: 'Trimestriel',
    price: 2500,
    days: 90,
    durationLabel: '3 mois',
    best: true,
    orangeMoneyUrl:
      'https://multi.app.orange-money.com/app/v1/kapptivate/qrcode/odyssee/?id=codgen1-e0ef6d8de7c7423097ba720d0b5738ab&v=1&amount=2500',
  },
]

export const formatFcfa = (n: number) =>
  `${n.toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ')} FCFA`

// Abidjan = UTC+0 toute l'année (pas d'heure d'été).
export function msUntilAbidjanMidnight(now = new Date()) {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  )
  return next - now.getTime()
}

// Grande Actualisation : chaque nuit à 03h00 (heure d'Abidjan) ; chaque sujet est renouvelé en 7 jours.
const REFRESH_ANCHOR = Date.UTC(2026, 0, 1, 3, 0, 0)
export function msUntilNextRefresh(now = new Date()) {
  const period = REFRESH_EVERY_DAYS * 24 * 3600 * 1000
  const elapsed = (now.getTime() - REFRESH_ANCHOR) % period
  return period - (elapsed < 0 ? elapsed + period : elapsed)
}

export function formatDuration(ms: number, withSeconds = false) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (d > 0) return `${d} j ${h} h`
  if (withSeconds)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${h} h ${String(m).padStart(2, '0')}`
}

export const ORAL_THEMES = [
  'Environnement',
  'Nouvelles technologies',
  'Jeunesse et éducation',
  'Culture et traditions',
  'Médias et réseaux sociaux',
  'Sciences et santé',
  'Voyages',
  'Sport',
  'Thème libre',
] as const

export const LEVELS = [
  { n: 1, label: 'Fondations', hint: 'Bases, exercices guidés' },
  { n: 2, label: 'Standard examen', hint: 'Format exact CEPE / BEPC / BAC' },
  { n: 3, label: 'Approfondissement', hint: 'Problèmes longs, concours' },
  { n: 4, label: 'Olympiades', hint: 'Très difficile' },
] as const

export const TUTOR_MODES = [
  'Expliquer',
  'Pas à pas',
  'Quiz',
  'Exercice similaire',
  'Corriger ma réponse',
  'Résumé de cours',
  'Discussion libre',
] as const
