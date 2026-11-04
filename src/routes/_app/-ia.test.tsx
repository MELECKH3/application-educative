import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'

const h = vi.hoisted(() => ({
  askTutor: vi.fn(),
  reportAiAnswer: vi.fn(),
  search: { sujet: undefined as string | undefined, mode: undefined as string | undefined },
}))
vi.mock('@/lib/ai.functions', () => ({
  askTutor: h.askTutor,
  reportAiAnswer: h.reportAiAnswer,
}))
vi.mock('@/lib/sujets.functions', () => ({ getSujet: vi.fn() }))
vi.mock('@/hooks/use-student', () => ({
  useStudent: () => ({ firstName: 'Awa', classe: 'Terminale', serie: 'D' }),
}))
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({
    useSearch: () => h.search,
    useLoaderData: () => null,
  }),
  Link: ({ children }: ComponentProps<'a'>) => <a>{children}</a>,
}))
import { TutorPage } from './ia'

beforeEach(() => {
  vi.resetAllMocks()
  sessionStorage.clear()
  h.search = { sujet: undefined, mode: undefined }
  Element.prototype.scrollIntoView = vi.fn()
})

it('envoie la question au tuteur IA et affiche sa réponse', async () => {
  h.askTutor.mockResolvedValue({ reply: 'Que sais-tu déjà des dérivées ?' })
  const user = userEvent.setup()
  render(<TutorPage />)
  expect(screen.getByText(/Bonjour Awa/)).toBeInTheDocument()
  await user.type(screen.getByLabelText('Ta question'), 'C’est quoi une dérivée ?')
  await user.click(screen.getByRole('button', { name: 'Envoyer' }))
  expect(await screen.findByText('Que sais-tu déjà des dérivées ?')).toBeInTheDocument()
  expect(h.askTutor.mock.calls[0][0].data).toMatchObject({
    mode: 'Expliquer',
    messages: [
      { role: 'tuteur' },
      { role: 'eleve', text: 'C’est quoi une dérivée ?' },
    ],
  })
})

it('propose des suggestions adaptées au mode choisi', async () => {
  h.askTutor.mockResolvedValue({ reply: 'Question 1 : …' })
  h.search.mode = 'Quiz'
  const user = userEvent.setup()
  render(<TutorPage />)
  await user.click(screen.getByRole('button', { name: 'Fais-moi un quiz sur les dérivées' }))
  await waitFor(() => expect(h.askTutor).toHaveBeenCalled())
  expect(h.askTutor.mock.calls[0][0].data.mode).toBe('Quiz')
})

it('garde la question et affiche une erreur lisible si l’IA échoue', async () => {
  h.askTutor.mockRejectedValue(new Error('L’IA est très demandée en ce moment.'))
  const user = userEvent.setup()
  render(<TutorPage />)
  await user.type(screen.getByLabelText('Ta question'), 'Aide-moi')
  await user.click(screen.getByRole('button', { name: 'Envoyer' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('très demandée')
  expect(screen.getByLabelText('Ta question')).toHaveValue('Aide-moi')
})

it('enregistre le signalement d’une réponse', async () => {
  h.askTutor.mockResolvedValue({ reply: 'Réponse douteuse' })
  h.reportAiAnswer.mockResolvedValue({ saved: true })
  const user = userEvent.setup()
  render(<TutorPage />)
  await user.type(screen.getByLabelText('Ta question'), 'Ma question')
  await user.click(screen.getByRole('button', { name: 'Envoyer' }))
  await screen.findByText('Réponse douteuse')
  await user.click(screen.getByRole('button', { name: 'Signaler cette réponse' }))
  await waitFor(() =>
    expect(h.reportAiAnswer).toHaveBeenCalledWith({
      data: { kind: 'tuteur', question: 'Ma question', answer: 'Réponse douteuse' },
    }),
  )
})
