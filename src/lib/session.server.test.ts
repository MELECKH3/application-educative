import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  adminGetUser: vi.fn(),
  request: {} as object,
}))
vi.mock('@netlify/identity', () => ({
  getUser: h.getUser,
  admin: { getUser: h.adminGetUser },
}))
vi.mock('@tanstack/react-start/server', () => ({ getRequest: () => h.request }))
import { sessionUser } from './session.server'

const jwt = (payload: object) =>
  `x.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.y`
const jar = new Map<string, string>()
const cookies = {
  get: (name: string) => jar.get(name),
  set: vi.fn(({ name, value }: { name: string; value: string }) => jar.set(name, value)),
}
const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  h.request = {}
  jar.clear()
  ;(globalThis as Record<string, unknown>).Netlify = {
    context: { cookies, url: new URL('https://annales.example') },
  }
  vi.stubGlobal('fetch', fetchMock)
  h.getUser.mockResolvedValue(null)
})
afterEach(() => {
  vi.unstubAllGlobals()
  delete (globalThis as Record<string, unknown>).Netlify
})

it('garde la session valide sans la renouveler', async () => {
  jar.set('nf_jwt', jwt({ sub: 'u1', exp: Date.now() / 1000 + 1800 }))
  jar.set('nf_refresh', 'r1')
  h.getUser.mockResolvedValue({ id: 'u1' })
  expect(await sessionUser()).toEqual({ id: 'u1' })
  expect(fetchMock).not.toHaveBeenCalled()
})

it('renouvelle un jeton expiré au lieu de renvoyer l’élève à la connexion', async () => {
  jar.set('nf_jwt', jwt({ sub: 'u1', exp: Date.now() / 1000 - 10 }))
  jar.set('nf_refresh', 'r1')
  const fresh = jwt({ sub: 'u1', exp: Date.now() / 1000 + 3600 })
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ access_token: fresh, refresh_token: 'r2' })),
  )
  h.adminGetUser.mockResolvedValue({ id: 'u1', email: 'eleve@gmail.com' })
  expect(await sessionUser()).toEqual({ id: 'u1', email: 'eleve@gmail.com' })
  expect(fetchMock.mock.calls[0][0]).toBe('https://annales.example/.netlify/identity/token')
  expect(jar.get('nf_jwt')).toBe(fresh)
  expect(jar.get('nf_refresh')).toBe('r2')
})

it('ne renouvelle qu’une fois par requête (garde de route + chargeur)', async () => {
  jar.set('nf_jwt', jwt({ sub: 'u1', exp: Date.now() / 1000 - 10 }))
  jar.set('nf_refresh', 'r1')
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ access_token: jwt({ sub: 'u1' }) })),
  )
  h.adminGetUser.mockResolvedValue({ id: 'u1' })
  await Promise.all([sessionUser(), sessionUser()])
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('n’efface pas les cookies si le renouvellement échoue', async () => {
  jar.set('nf_jwt', jwt({ sub: 'u1', exp: Date.now() / 1000 - 10 }))
  jar.set('nf_refresh', 'r1')
  fetchMock.mockResolvedValue(new Response('{}', { status: 400 }))
  expect(await sessionUser()).toBeNull()
  expect(jar.get('nf_refresh')).toBe('r1')
})
