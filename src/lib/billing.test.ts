import { describe, expect, it } from 'vitest'
import {
  cashPaymentSchema,
  isAdminIdentity,
  onlinePaymentSchema,
  reviewPaymentSchema,
} from './billing'
import { ADMIN_EMAIL } from './config'
import { safeReturnTo } from './profile'

const id = '00000000-0000-4000-8000-000000000001'
describe('droits administrateur', () => {
  it('exige à la fois l’adresse autorisée et le rôle Identity', () => {
    expect(
      isAdminIdentity({
        email: ADMIN_EMAIL,
        roles: ['admin'],
      }),
    ).toBe(true)
    expect(
      isAdminIdentity({
        email: ADMIN_EMAIL.toUpperCase(),
        roles: ['admin'],
      }),
    ).toBe(true)
    expect(
      isAdminIdentity({
        email: 'autre@example.com',
        roles: ['admin'],
      }),
    ).toBe(false)
    expect(isAdminIdentity({ email: ADMIN_EMAIL })).toBe(false)
    expect(isAdminIdentity(null)).toBe(false)
    expect(safeReturnTo('/admin?page=1')).toBe('/admin?page=1')
  })
})
describe('déclarations et décisions', () => {
  it('normalise les références pour empêcher le rejeu avec une casse différente et ignore le montant client', () => {
    expect(
      onlinePaymentSchema.parse({
        offerId: 'mensuel',
        method: 'Wave',
        reference: ' abc-123 ',
        receipt: { mediaType: 'image/png', data: 'A'.repeat(200) },
        amount: 1,
        status: 'accepted',
        userId: 'autre',
      }),
    ).toEqual({
      offerId: 'mensuel',
      method: 'Wave',
      reference: 'ABC-123',
      receipt: { mediaType: 'image/png', data: 'A'.repeat(200) },
    })
    expect(
      onlinePaymentSchema.safeParse({
        offerId: 'mensuel',
        method: 'Espèces',
        reference: 'ABC123',
      }).success,
    ).toBe(false)
  })
  it('exige une vérification pour accepter et un motif pour refuser', () => {
    expect(
      reviewPaymentSchema.safeParse({
        id,
        decision: 'accepted',
        verified: false,
        reason: '',
      }).success,
    ).toBe(false)
    expect(
      reviewPaymentSchema.safeParse({
        id,
        decision: 'rejected',
        verified: false,
        reason: '',
      }).success,
    ).toBe(false)
    expect(
      reviewPaymentSchema.safeParse({
        id,
        decision: 'rejected',
        verified: false,
        reason: 'Transaction absente du relevé',
      }).success,
    ).toBe(true)
  })
  it('refuse les espèces sans confirmation ou avec un montant incorrect', () => {
    const base = {
      id,
      userId: 'eleve',
      offerId: 'mensuel',
      amount: 1500,
      received: true,
    }
    expect(cashPaymentSchema.safeParse(base).success).toBe(true)
    expect(cashPaymentSchema.safeParse({ ...base, amount: 1499 }).success).toBe(
      false,
    )
    expect(
      cashPaymentSchema.safeParse({ ...base, received: false }).success,
    ).toBe(false)
    expect(
      cashPaymentSchema.safeParse({
        ...base,
        offerId: 'trimestriel',
        amount: 2500,
      }).success,
    ).toBe(true)
  })
})
