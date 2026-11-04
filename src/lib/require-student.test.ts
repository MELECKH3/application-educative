import { beforeEach, expect, it, vi } from 'vitest'
const { getAccount } = vi.hoisted(() => ({ getAccount: vi.fn() }))
vi.mock('./account.functions', () => ({ getAccount }))
import { requireStudent } from './require-student'
beforeEach(() => vi.resetAllMocks())
it('redirige un visiteur anonyme en conservant sa destination', async () => {
  getAccount.mockResolvedValue(null)
  await expect(
    requireStudent({ location: { href: '/profil' } }),
  ).rejects.toMatchObject({
    options: { to: '/connexion', search: { retour: '/profil' } },
  })
})
it('impose la création du profil après connexion', async () => {
  getAccount.mockResolvedValue({ user: { name: 'Élève test' }, profile: null })
  await expect(
    requireStudent({ location: { href: '/explorer' } }),
  ).rejects.toMatchObject({
    options: { to: '/bienvenue', search: { retour: '/explorer' } },
  })
})
it('autorise le compte connecté avec un profil complet', async () => {
  const account = {
    user: { name: 'Élève test' },
    profile: { firstName: 'Élève test' },
  }
  getAccount.mockResolvedValue(account)
  expect(await requireStudent({ location: { href: '/accueil' } })).toEqual({
    account,
  })
})
