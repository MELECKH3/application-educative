import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'

const mocks = vi.hoisted(() => ({
  saveProfile: vi.fn(),
  account: {
    user: { name: 'Élève test', email: 'eleve@example.com' },
    profile: null,
  },
}))
vi.mock('@/lib/account.functions', () => ({
  saveProfile: mocks.saveProfile,
  getAccount: vi.fn(),
}))
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({
    useSearch: () => ({ retour: '/profil' }),
    useRouteContext: () => ({ account: mocks.account }),
  }),
  redirect: vi.fn(),
  Link: ({ children }: ComponentProps<'a'>) => <a>{children}</a>,
}))
import { Bienvenue } from './bienvenue'
const assign = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  mocks.saveProfile.mockResolvedValue({ saved: true })
  const original = window
  vi.stubGlobal(
    'window',
    new Proxy(original, {
      get: (target, key) =>
        key === 'location' ? { assign } : Reflect.get(target, key),
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())
async function completeSteps() {
  render(<Bienvenue />)
  const user = userEvent.setup()
  await user.clear(screen.getByLabelText('Ton prénom'))
  await user.type(screen.getByLabelText('Ton prénom'), 'Élève test')
  await user.selectOptions(
    screen.getByLabelText('Ta tranche d’âge'),
    '16–17 ans',
  )
  await user.click(screen.getByRole('button', { name: 'Continuer' }))
  await user.type(screen.getByLabelText('Ton pays'), 'Côte d’Ivoire')
  await user.click(screen.getByRole('button', { name: 'Continuer' }))
  await user.selectOptions(screen.getByLabelText('Ta classe'), 'Terminale')
  await user.selectOptions(screen.getByLabelText('Ta série'), 'D')
  await user.click(screen.getByRole('button', { name: 'Continuer' }))
  return user
}
it('crée un profil complet en quatre étapes pour le compte connecté', async () => {
  const user = await completeSteps()
  await user.click(screen.getByLabelText('Anglais'))
  await user.click(
    screen.getByRole('button', { name: 'Enregistrer mon profil' }),
  )
  expect(mocks.saveProfile).toHaveBeenCalledWith({
    data: {
      firstName: 'Élève test',
      ageRange: '16–17 ans',
      pays: 'Côte d’Ivoire',
      classe: 'Terminale',
      serie: 'D',
      langues: ['Anglais'],
      niveauPrefere: 2,
    },
  })
  expect(assign).toHaveBeenCalledWith('/profil')
})
it('refuse un profil sans langue', async () => {
  const user = await completeSteps()
  await user.click(
    screen.getByRole('button', { name: 'Enregistrer mon profil' }),
  )
  expect(screen.getByRole('alert')).toHaveTextContent('au moins une langue')
  expect(mocks.saveProfile).not.toHaveBeenCalled()
})
it('conserve les réponses après une erreur et permet un nouvel enregistrement', async () => {
  mocks.saveProfile.mockRejectedValueOnce(new Error('indisponible'))
  const user = await completeSteps()
  await user.click(screen.getByLabelText('Anglais'))
  await user.click(
    screen.getByRole('button', { name: 'Enregistrer mon profil' }),
  )
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Tes réponses sont conservées',
  )
  expect(screen.getByLabelText('Anglais')).toBeChecked()
  await user.click(
    screen.getByRole('button', { name: 'Enregistrer mon profil' }),
  )
  await waitFor(() => expect(assign).toHaveBeenCalledWith('/profil'))
})
it('conserve les réponses quand on revient à une étape précédente', async () => {
  const user = await completeSteps()
  await user.click(screen.getByRole('button', { name: 'Retour' }))
  expect(screen.getByLabelText('Ta classe')).toHaveValue('Terminale')
  expect(screen.getByLabelText('Ta série')).toHaveValue('D')
})
