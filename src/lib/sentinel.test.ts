import { expect, it } from 'vitest'
import { analysePayment, normalizeReference, refusImmediat, referenceFactice } from './sentinel'

const base = {
  reference: 'MP241104.1532.A77812',
  amount: 1500,
  expectedAmount: 1500,
  sameReference: [],
  declarations24h: 1,
  refus30j: 0,
  autresEnAttente: 0,
  ageCompteMinutes: 3000,
  joursPremiumRestants: 0,
}

it('ne signale rien pour un paiement ordinaire', () => {
  expect(analysePayment(base)).toEqual({ gravite: null, score: 0, motifs: [] })
})

it('repère le rejeu d’un ID déjà accepté, même écrit autrement', () => {
  expect(normalizeReference('mp-2411.04')).toBe(normalizeReference('MP2411 04'))
  const v = analysePayment({ ...base, sameReference: ['accepted'] })
  expect(v.gravite).toBe('haute')
  expect(v.motifs[0].texte).toMatch(/rejeu/)
})

it('repère les ID inventés', () => {
  expect(referenceFactice('111111')).toBe(true)
  expect(referenceFactice('123456')).toBe(true)
  expect(referenceFactice('ABCDEFG')).toBe(true)
  expect(referenceFactice(base.reference)).toBe(false)
  expect(refusImmediat({ reference: '000000', sameReference: [] })).toMatch(/valide/)
})

it('cumule les signaux de risque', () => {
  const v = analysePayment({ ...base, refus30j: 2, declarations24h: 4, ageCompteMinutes: 10 })
  expect(v.gravite).toBe('moyenne')
  expect(v.score).toBe(48)
  expect(analysePayment({ ...base, amount: 1000 }).gravite).toBe('haute')
})
