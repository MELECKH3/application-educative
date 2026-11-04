import { expect, it } from 'vitest'
import { beneficiaireValide, decideReceipt, type ReceiptReading } from './recu'

const base: ReceiptReading = {
  lisible: true,
  est_recu: true,
  beneficiaire: 'Adou Melchi',
  montant: 2500,
  reference: 'TX-998877',
  date: '04/11/2026 10:12',
  operateur: 'Wave',
  statut_reussi: true,
  retouche_suspecte: false,
}

it('reconnaît les deux noms du bénéficiaire, quelle que soit l’écriture', () => {
  for (const n of ['ADOU MELCHI', 'Melchi Adou', 'adou meleckh', 'ADOU Mélchi', 'Adou Melchie'])
    expect(beneficiaireValide(n)).toBe(true)
  for (const n of ['Adou Jean', 'Melchi Kouassi', 'KONAN ADOU', '', null])
    expect(beneficiaireValide(n)).toBe(false)
})

it('refuse un reçu sans le bon bénéficiaire', () => {
  const d = decideReceipt({ ...base, beneficiaire: 'Yao Paul' }, { amount: 2500, reference: 'TX998877' })
  expect(d.type).toBe('refus')
})

it('refuse une image illisible ou qui n’est pas un reçu', () => {
  expect(decideReceipt({ ...base, lisible: false }, { amount: 2500, reference: 'X' }).type).toBe('refus')
  expect(decideReceipt({ ...base, est_recu: false }, { amount: 2500, reference: 'X' }).type).toBe('refus')
})

it('met en attente un reçu conforme, sans alerte', () => {
  const d = decideReceipt(base, { amount: 2500, reference: 'TX998877' })
  expect(d).toMatchObject({ type: 'attente', check: { nomOk: true, montantOk: true, referenceOk: true, alertes: [] } })
})

it('signale à l’admin un montant ou un ID différent', () => {
  const d = decideReceipt({ ...base, montant: 1500, reference: 'AUTRE1' }, { amount: 2500, reference: 'TX998877' })
  expect(d.type).toBe('attente')
  if (d.type === 'attente') expect(d.check.alertes).toHaveLength(2)
})

it('garde le paiement en attente si l’analyse est indisponible', () => {
  const d = decideReceipt(null, { amount: 1500, reference: 'ABC123' })
  expect(d.type).toBe('attente')
})
