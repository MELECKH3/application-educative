import { beforeEach, expect, it, vi } from 'vitest'

const { getUser, query, insert } = vi.hoisted(() => ({
  getUser: vi.fn(),
  query: vi.fn(),
  insert: vi.fn(),
}))
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    const builder = { validator: () => builder, handler: (fn: unknown) => fn }
    return builder
  },
}))
vi.mock('@tanstack/react-start/server', () => ({ setResponseHeader: vi.fn() }))
vi.mock('@netlify/identity', () => ({ getUser }))
vi.mock('../../db/index', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          query(condition)
          return { limit: async () => [] }
        },
      }),
    }),
    insert,
  },
}))
vi.mock('drizzle-orm', () => ({
  eq: (column: unknown, id: string) => ({ column, id }),
}))
import { getAccount, saveProfile } from './account.functions'

beforeEach(() => {
  vi.clearAllMocks()
  getUser.mockResolvedValue(null)
})
it('ne consulte aucune donnée pour un visiteur anonyme', async () => {
  expect(await getAccount()).toBeNull()
  getUser.mockResolvedValue({ id: '' })
  expect(await getAccount()).toBeNull()
  expect(query).not.toHaveBeenCalled()
})
it('reconnaît une session serveur issue du jeton, sans date de confirmation', async () => {
  // Côté serveur, Identity peut reconstruire l'utilisateur depuis le jeton : pas de confirmedAt.
  getUser.mockResolvedValue({ id: 'eleve-jeton', email: 'eleve@example.com' })
  expect(await getAccount()).not.toBeNull()
  expect(query).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'eleve-jeton' }),
  )
})
it('restreint la lecture au compte vérifié par le serveur', async () => {
  getUser.mockResolvedValue({
    id: 'eleve-connecte',
    confirmedAt: '2026-11-04',
    email: 'eleve@example.com',
  })
  const account = await getAccount()
  expect(query).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'eleve-connecte' }),
  )
  expect(account).toEqual({
    user: { email: 'eleve@example.com', name: undefined },
    isAdmin: false,
    access: null,
    profile: null,
  })
})
it('refuse une écriture sans session', async () => {
  await expect(
    saveProfile({
      data: {
        firstName: 'Fatou',
        ageRange: '16–17 ans',
        pays: 'Sénégal',
        classe: 'Terminale',
        serie: 'S',
        langues: ['Anglais'],
        niveauPrefere: 2,
      },
    }),
  ).rejects.toThrow()
  expect(insert).not.toHaveBeenCalled()
})

it('rattache toute écriture à la session serveur', async () => {
  getUser.mockResolvedValue({ id: 'eleve-connecte', confirmedAt: '2026-11-04' })
  const upsert = vi.fn().mockResolvedValue(undefined)
  const values = vi.fn().mockReturnValue({ onConflictDoUpdate: upsert })
  insert.mockReturnValue({ values })
  await saveProfile({
    data: {
      firstName: 'Fatou',
      ageRange: '16–17 ans',
      pays: 'Sénégal',
      classe: 'Terminale',
      serie: 'S',
      langues: ['Anglais'],
      niveauPrefere: 2,
    },
  })
  expect(values).toHaveBeenCalledWith(
    expect.objectContaining({ userId: 'eleve-connecte' }),
  )
  expect(upsert).toHaveBeenCalledOnce()
})
