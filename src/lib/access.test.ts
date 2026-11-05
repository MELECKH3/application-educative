import { expect, it } from 'vitest'
import { accessFrom, formatFinAcces, limitesFor, planOf } from './access'

const DAY = 86_400_000
const start = new Date('2026-11-01T10:00:00Z')

it('ouvre 3 jours d’essai complet à partir de la création du profil', () => {
  const a = accessFrom(start, null, new Date(start.getTime() + 1 * DAY))
  expect(a).toMatchObject({ status: 'essai', joursRestants: 2 })
  expect(planOf(a)).toBe('trimestriel')
})

it('passe au forfait gratuit de 40 min/jour après l’essai', () => {
  const now = new Date('2026-11-09T15:00:00Z')
  const a = accessFrom(start, null, now, {
    minutesOffertes: null,
    secondesUtilisees: 600,
  })
  expect(a).toMatchObject({
    status: 'gratuit',
    minutesParJour: 40,
    offert: false,
    secondesRestantes: 1800,
    reprise: '2026-11-10T00:00:00.000Z',
  })
  expect(limitesFor(a).oral).toBe(false)
})

it('garde 40 min/jour quand l’admin a activé le forfait élargi', () => {
  const a = accessFrom(start, null, new Date(start.getTime() + 9 * DAY), {
    minutesOffertes: 40,
    secondesUtilisees: 30 * 60,
  })
  expect(a).toMatchObject({ status: 'gratuit', minutesParJour: 40, offert: true, secondesRestantes: 600 })
})

it('bloque quand le temps gratuit du jour est épuisé', () => {
  const a = accessFrom(start, null, new Date(start.getTime() + 9 * DAY), {
    minutesOffertes: null,
    secondesUtilisees: 40 * 60,
  })
  expect(a.status).toBe('bloque')
})

it('débloque sans limite avec un abonnement actif', () => {
  const exp = new Date(start.getTime() + 40 * DAY)
  const a = accessFrom(
    start,
    { expiresAt: exp, offerId: 'mensuel' },
    new Date(start.getTime() + 10 * DAY),
    { minutesOffertes: null, secondesUtilisees: 99_999 },
  )
  expect(a).toEqual({ status: 'abonne', until: exp.toISOString(), offerId: 'mensuel' })
  expect(planOf(a)).toBe('mensuel')
  expect(limitesFor(a).niveaux).toEqual([1, 2, 3, 4])
})

it('revient au forfait gratuit à l’expiration de l’abonnement', () => {
  const exp = new Date(start.getTime() + 37 * DAY)
  const a = accessFrom(
    start,
    { expiresAt: exp, offerId: 'trimestriel' },
    new Date(start.getTime() + 38 * DAY),
  )
  expect(a.status).toBe('gratuit')
})

it('affiche la date de fin d’essai en heure d’Abidjan', () => {
  expect(formatFinAcces('2026-11-11T14:30:00.000Z')).toBe('mercredi 11 novembre 2026 à 14:30')
})
