import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'

const auth = vi.hoisted(() => ({
  getSettings: vi.fn(),
  getUser: vi.fn(),
  handleAuthCallback: vi.fn(),
  login: vi.fn(),
  signup: vi.fn(),
  oauthLogin: vi.fn(),
  requestPasswordRecovery: vi.fn(),
  updateUser: vi.fn(),
  acceptInvite: vi.fn(),
  refreshSession: vi.fn(),
}))
vi.mock('@netlify/identity', () => ({
  ...auth,
  AuthError: class extends Error {
    status?: number
  },
}))
const createAccount = vi.hoisted(() => vi.fn())
vi.mock('@/lib/account.functions', () => ({ createAccount }))
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({ useSearch: () => ({ retour: '/profil' }) }),
  Link: ({ children }: ComponentProps<'a'>) => <a>{children}</a>,
}))
import { AuthError } from '@netlify/identity'
import { Connexion } from './connexion'
import { ADMIN_EMAIL } from '@/lib/config'
const location = {
  hash: '',
  pathname: '/connexion',
  search: '',
  assign: vi.fn(),
  replace: vi.fn(),
}
const password = crypto.randomUUID()
beforeEach(() => {
  vi.resetAllMocks()
  sessionStorage.clear()
  location.hash = ''
  auth.getSettings.mockResolvedValue({
    providers: { google: true },
    disableSignup: false,
  })
  auth.getUser.mockResolvedValue(null)
  auth.handleAuthCallback.mockResolvedValue(null)
  createAccount.mockResolvedValue({ status: 'fallback' })
  const original = window
  vi.stubGlobal(
    'window',
    new Proxy(original, {
      get: (target, key) =>
        key === 'location' ? location : Reflect.get(target, key),
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())
async function ready() {
  render(<Connexion />)
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Me connecter' })).toBeEnabled(),
  )
  return userEvent.setup()
}
async function credentials(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Adresse e-mail'), 'eleve@example.com')
  await user.type(screen.getByLabelText('Mot de passe'), password)
}
it('connecte un élève et retrouve la destination demandée', async () => {
  const user = await ready()
  await credentials(user)
  await user.click(screen.getByRole('button', { name: 'Me connecter' }))
  expect(auth.login).toHaveBeenCalledWith('eleve@example.com', password)
  expect(location.assign).toHaveBeenCalledWith('/profil')
})
it('ouvre le compte tout de suite avec l’adresse et le mot de passe', async () => {
  createAccount.mockResolvedValue({ status: 'created' })
  const user = await ready()
  await user.click(screen.getByRole('button', { name: 'Créer un compte' }))
  await credentials(user)
  await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))
  expect(createAccount).toHaveBeenCalledWith({
    data: { email: 'eleve@example.com', password },
  })
  expect(auth.signup).not.toHaveBeenCalled()
  expect(auth.login).toHaveBeenCalledWith('eleve@example.com', password)
  expect(location.assign).toHaveBeenCalledWith('/profil')
})
it('signale un compte déjà existant à l’inscription', async () => {
  createAccount.mockResolvedValue({ status: 'exists' })
  const user = await ready()
  await user.click(screen.getByRole('button', { name: 'Créer un compte' }))
  await credentials(user)
  await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))
  expect(screen.getByRole('alert')).toHaveTextContent('existe déjà')
  expect(location.assign).not.toHaveBeenCalled()
})
it('active à la connexion un ancien compte jamais confirmé', async () => {
  auth.login
    .mockRejectedValueOnce(new AuthError('Email not confirmed'))
    .mockResolvedValueOnce(undefined)
  createAccount.mockResolvedValue({ status: 'created' })
  const user = await ready()
  await credentials(user)
  await user.click(screen.getByRole('button', { name: 'Me connecter' }))
  expect(auth.login).toHaveBeenCalledTimes(2)
  expect(location.assign).toHaveBeenCalledWith('/profil')
})
it('ne relance pas une redirection en boucle si le serveur refuse la session', async () => {
  auth.getUser.mockResolvedValue({ confirmedAt: '2026-11-04' })
  sessionStorage.setItem('annales-saut', String(Date.now()))
  render(<Connexion />)
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'session n’a pas pu être ouverte',
  )
  expect(location.replace).not.toHaveBeenCalled()
})
it('inscrit sans annoncer une connexion avant confirmation', async () => {
  auth.signup.mockResolvedValue({})
  const user = await ready()
  await user.click(screen.getByRole('button', { name: 'Créer un compte' }))
  await credentials(user)
  await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))
  expect(auth.signup).toHaveBeenCalledWith('eleve@example.com', password)
  expect(screen.getByRole('status')).toHaveTextContent('confirme ton adresse')
  expect(location.assign).not.toHaveBeenCalled()
})
it('redirige une inscription déjà confirmée', async () => {
  auth.signup.mockResolvedValue({ confirmedAt: '2026-11-04' })
  const user = await ready()
  await user.click(screen.getByRole('button', { name: 'Créer un compte' }))
  await credentials(user)
  await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))
  expect(location.assign).toHaveBeenCalledWith('/profil')
})
it('lance Google et conserve la page de retour', async () => {
  const user = await ready()
  await user.click(
    screen.getByRole('button', { name: 'Continuer avec Google' }),
  )
  expect(auth.oauthLogin).toHaveBeenCalledWith('google')
  expect(sessionStorage.getItem('annales-retour')).toBe('/profil')
})
it('propose la connexion Gmail par mot de passe sans bouton Google désactivé', async () => {
  auth.getSettings.mockResolvedValue({
    providers: { google: false },
    disableSignup: false,
  })
  await ready()
  expect(
    screen.queryByRole('button', { name: 'Continuer avec Google' }),
  ).not.toBeInTheDocument()
  expect(screen.getByText(/Gmail acceptée/)).toBeVisible()
  expect(screen.getByText(/pas celui de ta boîte Gmail/)).toBeVisible()
})
it('respecte les inscriptions fermées', async () => {
  auth.getSettings.mockResolvedValue({
    providers: { google: false },
    disableSignup: true,
  })
  await ready()
  expect(screen.getByRole('button', { name: 'Créer un compte' })).toBeDisabled()
  expect(screen.getByText(/Les inscriptions sont fermées/)).toBeVisible()
})
it('affiche une erreur française et permet de réessayer', async () => {
  auth.login.mockRejectedValue(new Error('diagnostic privé'))
  const user = await ready()
  await credentials(user)
  await user.click(screen.getByRole('button', { name: 'Me connecter' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Impossible de terminer')
  expect(screen.getByRole('alert')).not.toHaveTextContent('diagnostic privé')
  expect(screen.getByRole('button', { name: 'Me connecter' })).toBeEnabled()
})
it('demande un lien de récupération sans révéler les comptes existants', async () => {
  const user = await ready()
  await user.click(
    screen.getByRole('button', { name: 'Mot de passe oublié ?' }),
  )
  await user.type(screen.getByLabelText('Adresse e-mail'), 'eleve@example.com')
  await user.click(screen.getByRole('button', { name: 'Recevoir le lien' }))
  expect(auth.requestPasswordRecovery).toHaveBeenCalledWith('eleve@example.com')
  expect(screen.getByRole('status')).toHaveTextContent(
    'Si un compte correspond',
  )
})
it('enregistre le nouveau mot de passe après récupération', async () => {
  auth.handleAuthCallback.mockResolvedValue({ type: 'recovery' })
  render(<Connexion />)
  const button = await screen.findByRole('button', {
    name: 'Enregistrer le mot de passe',
  })
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Mot de passe'), password)
  await user.click(button)
  expect(auth.updateUser).toHaveBeenCalledWith({ password })
  expect(location.assign).toHaveBeenCalledWith('/profil')
})
it('accepte une invitation avec un nouveau mot de passe', async () => {
  const token = crypto.randomUUID()
  auth.handleAuthCallback.mockResolvedValue({ type: 'invite', token })
  render(<Connexion />)
  const button = await screen.findByRole('button', {
    name: 'Activer mon compte',
  })
  const user = userEvent.setup()
  expect(screen.queryByLabelText('Adresse e-mail')).not.toBeInTheDocument()
  await user.type(screen.getByLabelText('Mot de passe'), password)
  await user.click(button)
  expect(auth.acceptInvite).toHaveBeenCalledWith(token, password)
  expect(location.assign).toHaveBeenCalledWith('/profil')
})
it('traite le retour Google et restaure la session confirmée', async () => {
  auth.handleAuthCallback.mockResolvedValue({ type: 'oauth' })
  auth.getUser.mockResolvedValue({ confirmedAt: '2026-11-04' })
  sessionStorage.setItem('annales-retour', '/explorer')
  render(<Connexion />)
  await waitFor(() =>
    expect(location.replace).toHaveBeenCalledWith('/explorer'),
  )
  expect(sessionStorage.getItem('annales-retour')).toBeNull()
})
it('signale une indisponibilité du service sans afficher de diagnostic interne', async () => {
  auth.getSettings.mockRejectedValue(new Error('diagnostic privé'))
  render(<Connexion />)
  expect(await screen.findByRole('alert')).toHaveTextContent('indisponible')
})

it('explique le mot de passe Annales+ après des identifiants refusés', async () => {
  auth.login.mockRejectedValue(new AuthError('Invalid login credentials'))
  auth.signup.mockRejectedValue(
    new AuthError('A user with this email address has already been registered'),
  )
  const user = await ready()
  await credentials(user)
  await user.click(screen.getByRole('button', { name: 'Me connecter' }))
  expect(screen.getByRole('alert')).toHaveTextContent(
    'mot de passe de ton compte Annales+',
  )
  expect(screen.getByRole('alert')).toHaveTextContent('Créer un compte')
  expect(screen.getByRole('button', { name: 'Me connecter' })).toBeEnabled()
})
it('explique comment débloquer une adresse non confirmée', async () => {
  auth.login.mockRejectedValue(new AuthError('Email not confirmed'))
  auth.signup.mockRejectedValue(new AuthError('Erreur réseau'))
  const user = await ready()
  await credentials(user)
  await user.click(screen.getByRole('button', { name: 'Me connecter' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Confirme ton adresse')
  expect(screen.getByRole('alert')).toHaveTextContent('courriers indésirables')
})
it('renvoie le lien de confirmation quand le compte ne peut pas être activé tout de suite', async () => {
  auth.login.mockRejectedValue(
    new AuthError('invalid_grant: Email not confirmed'),
  )
  auth.signup.mockResolvedValue({ confirmedAt: null })
  const user = await ready()
  await credentials(user)
  await user.click(screen.getByRole('button', { name: 'Me connecter' }))
  expect(auth.signup).toHaveBeenCalledWith('eleve@example.com', password)
  expect(screen.getByRole('status')).toHaveTextContent('Spam')
  expect(location.assign).not.toHaveBeenCalled()
})
it('connexion admin sans compte confirmé : envoie le lien au lieu de dire « mot de passe incorrect »', async () => {
  auth.login.mockRejectedValue(
    new AuthError(
      'invalid_grant: No user found with that email, or password invalid.',
    ),
  )
  auth.signup.mockResolvedValue({ confirmedAt: null })
  const user = await ready()
  await user.type(screen.getByLabelText('Adresse e-mail'), ADMIN_EMAIL)
  await user.type(screen.getByLabelText('Mot de passe'), password)
  await user.click(screen.getByRole('button', { name: 'Me connecter' }))
  expect(createAccount).toHaveBeenCalled()
  expect(auth.signup).toHaveBeenCalledWith(ADMIN_EMAIL, password)
  expect(screen.getByRole('status')).toHaveTextContent(
    'console d’administration',
  )
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
it('connexion admin avec un compte confirmé et un mauvais mot de passe', async () => {
  auth.login.mockRejectedValue(
    new AuthError(
      'invalid_grant: No user found with that email, or password invalid.',
    ),
  )
  auth.signup.mockRejectedValue(
    new AuthError('A user with this email address has already been registered'),
  )
  const user = await ready()
  await user.type(screen.getByLabelText('Adresse e-mail'), ADMIN_EMAIL)
  await user.type(screen.getByLabelText('Mot de passe'), password)
  await user.click(screen.getByRole('button', { name: 'Me connecter' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Mot de passe oublié')
  expect(location.assign).not.toHaveBeenCalled()
})
it('connecte l’admin et l’envoie sur la console', async () => {
  auth.getUser
    .mockResolvedValueOnce(null)
    .mockResolvedValue({ email: ADMIN_EMAIL, confirmedAt: '2026-11-05' })
  const user = await ready()
  await user.type(screen.getByLabelText('Adresse e-mail'), ADMIN_EMAIL)
  await user.type(screen.getByLabelText('Mot de passe'), password)
  await user.click(screen.getByRole('button', { name: 'Me connecter' }))
  expect(location.assign).toHaveBeenCalledWith('/admin')
})
it('après confirmation, l’admin choisit son propre mot de passe', async () => {
  auth.handleAuthCallback.mockResolvedValue({
    type: 'confirmation',
    user: { email: ADMIN_EMAIL, confirmedAt: '2026-11-05' },
  })
  auth.getUser.mockResolvedValue({
    email: ADMIN_EMAIL,
    confirmedAt: '2026-11-05',
  })
  render(<Connexion />)
  const button = await screen.findByRole('button', {
    name: 'Enregistrer le mot de passe',
  })
  expect(location.replace).not.toHaveBeenCalled()
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Mot de passe'), password)
  await user.click(button)
  expect(auth.updateUser).toHaveBeenCalledWith({ password })
  expect(location.assign).toHaveBeenCalledWith('/admin')
})
it('explique qu’un lien e-mail expiré doit être redemandé', async () => {
  location.hash = '#confirmation_token=perime'
  auth.handleAuthCallback.mockRejectedValue(new AuthError('Token expired'))
  render(<Connexion />)
  expect(await screen.findByRole('alert')).toHaveTextContent('expiré')
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Me connecter' })).toBeEnabled(),
  )
})

it('renouvelle une session expirée avant de rouvrir la page demandée', async () => {
  auth.handleAuthCallback.mockResolvedValue(null)
  auth.getUser.mockResolvedValue({ confirmedAt: '2026-11-04' })
  auth.refreshSession.mockResolvedValue('jeton-neuf')
  render(<Connexion />)
  await waitFor(() => expect(location.replace).toHaveBeenCalledWith('/profil'))
  expect(auth.refreshSession).toHaveBeenCalled()
  expect(auth.refreshSession.mock.invocationCallOrder[0]).toBeLessThan(
    location.replace.mock.invocationCallOrder[0],
  )
})
