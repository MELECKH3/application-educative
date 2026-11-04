import { describe, expect, it, vi } from 'vitest'

vi.mock('@netlify/database', () => ({
  getDatabase: () => ({ sql: async () => [{ value: 'oui' }] }),
}))

import { toCsv } from './admin.server'
import identity from '../../netlify/functions/identity.mts'
import { ADMIN_EMAIL } from './config'

describe('toCsv', () => {
  it('sépare par « ; » et échappe les guillemets et retours à la ligne', () => {
    expect(
      toCsv(
        ['a', 'b'],
        [
          ['x;y', 'il dit "oui"'],
          [null, 3],
        ],
      ),
    ).toBe('a;b\r\n"x;y";"il dit ""oui"""\r\n;3')
  })
})

describe('événements Identity', () => {
  const deny = vi.fn(() => 'refusé')
  it('ajoute le rôle admin à la connexion de l’adresse admin confirmée', () => {
    const res = identity.userLogin({
      user: {
        email: ADMIN_EMAIL.toUpperCase(),
        confirmedAt: '2026-11-04',
        appMetadata: { roles: ['eleve'] },
      },
      deny,
    })
    expect(res?.user.appMetadata.roles).toEqual(['eleve', 'admin'])
  })
  it('ne donne rien à une adresse non confirmée ou différente', () => {
    expect(
      identity.userLogin({
        user: { email: ADMIN_EMAIL, confirmedAt: null },
        deny,
      }),
    ).toBeUndefined()
    expect(
      identity.userLogin({
        user: { email: 'autre@exemple.ci', confirmedAt: '2026-11-04' },
        deny,
      }),
    ).toBeUndefined()
  })
  it('refuse les inscriptions quand l’interrupteur est coupé', async () => {
    expect(
      await identity.userValidate({ user: { email: 'a@b.ci' }, deny }),
    ).toBe('refusé')
  })
})
