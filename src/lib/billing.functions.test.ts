// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import { ADMIN_EMAIL } from './config'

const { getUser, sql, query, release, connect } = vi.hoisted(() => ({
  getUser: vi.fn(),
  sql: vi.fn(),
  query: vi.fn(),
  release: vi.fn(),
  connect: vi.fn(),
}))
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    const builder = { validator: () => builder, handler: (fn: unknown) => fn }
    return builder
  },
}))
vi.mock('@tanstack/react-start/server', () => ({ setResponseHeader: vi.fn() }))
vi.mock('@netlify/identity', () => ({ getUser }))
vi.mock('@netlify/database', () => ({
  getDatabase: () => ({ sql, pool: { connect } }),
}))
const recu = vi.hoisted(() => ({
  readReceipt: vi.fn(),
  saveReceipt: vi.fn(),
  receiptChecksLastHour: vi.fn(),
}))
vi.mock('./recu.server', () => recu)
vi.mock('./sentinel.server', () => ({
  sameReferenceStatuses: vi.fn(async () => []),
  sentinelVerdicts: vi.fn(async () => ({})),
}))
const receipt = { mediaType: 'image/jpeg' as const, data: 'A'.repeat(200) }
const lectureOk = {
  lisible: true,
  est_recu: true,
  beneficiaire: 'ADOU MELCHI',
  montant: 1500,
  reference: 'ABC123',
  date: null,
  operateur: 'Wave',
  statut_reussi: true,
  retouche_suspecte: false,
}
import {
  getBilling,
  getAdminDashboard,
  recordCashPayment,
  reviewPayment,
  submitPayment,
} from './billing.functions'

const student = { id: 'eleve', email: 'eleve@example.com', confirmedAt: 'date' }
const admin = {
  id: 'admin',
  email: ADMIN_EMAIL,
  confirmedAt: 'date',
  roles: ['admin'],
}
const paymentId = '00000000-0000-4000-8000-000000000001'
beforeEach(() => {
  vi.resetAllMocks()
  getUser.mockResolvedValue(admin)
  sql.mockResolvedValue([{ role: 'admin' }])
  connect.mockResolvedValue({ query, release })
  query.mockResolvedValue({ rows: [] })
  recu.readReceipt.mockResolvedValue(lectureOk)
  recu.saveReceipt.mockResolvedValue('cle')
  recu.receiptChecksLastHour.mockResolvedValue(0)
})

it('bloque tous les traitements financiers admin avant accès à la base pour un élève', async () => {
  getUser.mockResolvedValue({ ...student, userMetadata: { roles: ['admin'] } })
  await expect(getAdminDashboard({ data: { page: 0 } })).rejects.toThrow(
    'Accès réservé',
  )
  await expect(
    reviewPayment({
      data: { id: paymentId, decision: 'accepted', verified: true, reason: '' },
    }),
  ).rejects.toThrow('Accès réservé')
  await expect(
    recordCashPayment({
      data: {
        id: paymentId,
        userId: 'eleve',
        offerId: 'mensuel',
        amount: 1500,
        received: true,
      },
    }),
  ).rejects.toThrow('Accès réservé')
  expect(sql).not.toHaveBeenCalled()
  expect(connect).not.toHaveBeenCalled()
})
it('ne retourne aucune donnée de facturation sans session', async () => {
  getUser.mockResolvedValue(null)
  expect(await getBilling()).toBeNull()
  await expect(
    submitPayment({
      data: { offerId: 'mensuel', method: 'Wave', reference: 'ABC123', receipt },
    }),
  ).rejects.toThrow('Connecte-toi')
  expect(sql).not.toHaveBeenCalled()
  expect(connect).not.toHaveBeenCalled()
})
it('rattache la déclaration au compte serveur et ne déclenche aucune activation', async () => {
  getUser.mockResolvedValue(student)
  query.mockImplementation(async (statement: string) => ({
    rows: statement.startsWith('SELECT user_id')
      ? [{ user_id: 'eleve' }]
      : statement.includes('FILTER')
        ? [{ recent: 0, rejected: 0 }]
        : [],
  }))
  await submitPayment({
    data: { offerId: 'mensuel', method: 'Wave', reference: 'ABC123', receipt },
  })
  const insertion = query.mock.calls.find(([s]) =>
    s.startsWith('INSERT INTO payments'),
  )!
  expect(insertion[1].slice(1, 8)).toEqual([
    'eleve',
    student.email,
    'mensuel',
    1500,
    30,
    'Wave',
    'ABC123',
  ])
  expect(
    query.mock.calls.some(([s]) => s.includes('INSERT INTO subscriptions')),
  ).toBe(false)
  expect(query).toHaveBeenLastCalledWith('COMMIT')
})
it('suspend les déclarations après trois refus récents sans enregistrer de paiement', async () => {
  getUser.mockResolvedValue(student)
  query.mockImplementation(async (statement: string) => ({
    rows: statement.startsWith('SELECT user_id')
      ? [{ user_id: 'eleve' }]
      : statement.includes('FILTER')
        ? [{ recent: 0, rejected: 3 }]
        : [],
  }))
  await expect(
    submitPayment({
      data: { offerId: 'mensuel', method: 'Wave', reference: 'ABC123', receipt },
    }),
  ).rejects.toThrow('suspendues')
  expect(query.mock.calls.some(([s]) => s.startsWith('INSERT'))).toBe(false)
  expect(query).toHaveBeenLastCalledWith('ROLLBACK')
})
it('refuse de traiter deux fois un paiement déjà accepté', async () => {
  query.mockImplementation(async (statement: string) => ({
    rows: statement.startsWith('SELECT user_id')
      ? [{ user_id: 'eleve' }]
      : statement.includes('FOR UPDATE')
        ? [{ status: 'accepted' }]
        : [],
  }))
  await expect(
    reviewPayment({
      data: { id: paymentId, decision: 'accepted', verified: true, reason: '' },
    }),
  ).rejects.toThrow('déjà été traité')
  expect(
    query.mock.calls.some(([s]) => s.includes('INSERT INTO subscriptions')),
  ).toBe(false)
  expect(query).toHaveBeenLastCalledWith('ROLLBACK')
  expect(release).toHaveBeenCalledOnce()
})
it('valide, prolonge et journalise un paiement dans une seule transaction', async () => {
  query.mockImplementation(async (statement: string) => ({
    rows: statement.startsWith('SELECT user_id')
      ? [{ user_id: 'eleve' }]
      : statement.includes('FOR UPDATE')
        ? [
            {
              status: 'pending',
              user_id: 'eleve',
              offer_id: 'trimestriel',
              amount: 2500,
              days: 90,
            },
          ]
        : [],
  }))
  await reviewPayment({
    data: { id: paymentId, decision: 'accepted', verified: true, reason: '' },
  })
  const activation = query.mock.calls.find(([s]) =>
    s.includes('INSERT INTO subscriptions'),
  )!
  expect(activation[1]).toEqual(['eleve', 'trimestriel', 90])
  expect(activation[0]).toContain('GREATEST(subscriptions.expires_at, now())')
  expect(
    query.mock.calls.find(([s]) => s.startsWith('UPDATE payments'))?.[1],
  ).toEqual([paymentId, 'accepted', null, 'admin'])
  expect(
    query.mock.calls.some(([s]) => s.includes('INSERT INTO payment_audit')),
  ).toBe(true)
  expect(query).toHaveBeenLastCalledWith('COMMIT')
})
it('annule aussi la validation si la journalisation échoue', async () => {
  query.mockImplementation(async (statement: string) => {
    if (statement.includes('INSERT INTO payment_audit'))
      throw new Error('Journal indisponible')
    return {
      rows: statement.startsWith('SELECT user_id')
        ? [{ user_id: 'eleve' }]
        : statement.includes('FOR UPDATE')
          ? [
              {
                status: 'pending',
                user_id: 'eleve',
                offer_id: 'mensuel',
                amount: 1500,
                days: 30,
              },
            ]
          : [],
    }
  })
  await expect(
    reviewPayment({
      data: { id: paymentId, decision: 'accepted', verified: true, reason: '' },
    }),
  ).rejects.toThrow()
  expect(query).toHaveBeenLastCalledWith('ROLLBACK')
  expect(query.mock.calls.some(([s]) => s === 'COMMIT')).toBe(false)
})
it('conserve une seule activation lors du renvoi du même encaissement en espèces', async () => {
  query.mockImplementation(async (statement: string) => ({
    rows: statement.startsWith('SELECT id, user_id')
      ? [
          {
            id: paymentId,
            user_id: 'eleve',
            offer_id: 'mensuel',
            method: 'Espèces',
          },
        ]
      : [],
  }))
  expect(
    await recordCashPayment({
      data: {
        id: paymentId,
        userId: 'eleve',
        offerId: 'mensuel',
        amount: 1500,
        received: true,
      },
    }),
  ).toEqual({ id: paymentId })
  expect(query.mock.calls.some(([s]) => s.startsWith('INSERT'))).toBe(false)
})
it('enregistre les espèces pour un élève existant avec le tarif et la durée officiels', async () => {
  query.mockImplementation(async (statement: string) => ({
    rows: statement.startsWith('SELECT user_id') ? [{ user_id: 'eleve' }] : [],
  }))
  await recordCashPayment({
    data: {
      id: paymentId,
      userId: 'eleve',
      offerId: 'mensuel',
      amount: 1500,
      received: true,
    },
  })
  expect(
    query.mock.calls.find(([s]) => s.startsWith('INSERT INTO payments'))?.[1],
  ).toEqual([
    paymentId,
    'eleve',
    'mensuel',
    1500,
    30,
    'ESPECES-' + paymentId,
    'admin',
  ])
  expect(
    query.mock.calls.find(([s]) =>
      s.includes('INSERT INTO subscriptions'),
    )?.[1],
  ).toEqual(['eleve', 'mensuel', 30])
  expect(query).toHaveBeenLastCalledWith('COMMIT')
})
it('refuser un paiement n’active pas l’abonnement et garde le motif', async () => {
  query.mockImplementation(async (statement: string) => ({
    rows: statement.startsWith('SELECT user_id')
      ? [{ user_id: 'eleve' }]
      : statement.includes('FOR UPDATE')
        ? [
            {
              status: 'pending',
              user_id: 'eleve',
              offer_id: 'mensuel',
              amount: 1500,
              days: 30,
            },
          ]
        : [],
  }))
  await reviewPayment({
    data: {
      id: paymentId,
      decision: 'rejected',
      verified: false,
      reason: 'Transaction absente du relevé',
    },
  })
  expect(
    query.mock.calls.some(([s]) => s.includes('INSERT INTO subscriptions')),
  ).toBe(false)
  expect(
    query.mock.calls.find(([s]) => s.startsWith('UPDATE payments'))?.[1],
  ).toEqual([paymentId, 'rejected', 'Transaction absente du relevé', 'admin'])
})

it('refuse un reçu qui ne porte pas le nom du bénéficiaire, sans enregistrer de paiement', async () => {
  getUser.mockResolvedValue(student)
  recu.readReceipt.mockResolvedValue({ ...lectureOk, beneficiaire: 'KOUASSI JEAN' })
  await expect(
    submitPayment({
      data: { offerId: 'mensuel', method: 'Wave', reference: 'ABC123', receipt },
    }),
  ).rejects.toThrow('ADOU MELCHI ou ADOU MELECKH')
  expect(connect).not.toHaveBeenCalled()
  expect(recu.saveReceipt).not.toHaveBeenCalled()
})
it('enregistre le reçu conforme et son contrôle pour l’administrateur', async () => {
  getUser.mockResolvedValue(student)
  query.mockImplementation(async (statement: string) => ({
    rows: statement.startsWith('SELECT user_id')
      ? [{ user_id: 'eleve' }]
      : statement.includes('FILTER')
        ? [{ recent: 0, rejected: 0 }]
        : [],
  }))
  const res = await submitPayment({
    data: { offerId: 'mensuel', method: 'Wave', reference: 'ABC123', receipt },
  })
  expect(res).toMatchObject({ nomOk: true, alertes: 0 })
  const insertion = query.mock.calls.find(([s]) => s.startsWith('INSERT INTO payments'))!
  expect(insertion[1][8]).toBe('cle')
  expect(JSON.parse(insertion[1][9])).toMatchObject({ nomOk: true, montantOk: true })
})
