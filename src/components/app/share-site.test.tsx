import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { ShareSite, shareLinks } from './share-site'
import { SITE_URL } from '@/lib/config'

it('affiche le lien du site et des liens de partage qui le contiennent', () => {
  render(<ShareSite />)
  expect(screen.getByText('etudemodern.netlify.app')).toBeInTheDocument()
  const links = shareLinks()
  expect(decodeURIComponent(links.whatsapp)).toContain(SITE_URL)
  expect(decodeURIComponent(links.facebook)).toContain(SITE_URL)
  expect(screen.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', links.whatsapp)
})

it('copie le lien du site', async () => {
  const user = userEvent.setup()
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  render(<ShareSite />)
  await user.click(screen.getByRole('button', { name: 'Copier le lien' }))
  expect(writeText).toHaveBeenCalledWith(SITE_URL)
  expect(await screen.findByText('Lien copié')).toBeInTheDocument()
})
