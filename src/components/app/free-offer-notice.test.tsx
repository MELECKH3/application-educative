import { render, screen } from '@testing-library/react'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Access } from '@/lib/access'
import { FreeOfferNotice, freePlanSummary } from './free-offer-notice'

async function renderNotice(access: Access) {
  const root = createRootRoute({
    component: () => <FreeOfferNotice access={access} />,
  })
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(<RouterProvider router={router} />)
}

describe('rappel de l’offre gratuite', () => {
  beforeEach(() => sessionStorage.clear())

  it('résume les vraies limites du forfait gratuit', () => {
    expect(freePlanSummary(30)).toContain('30 min par jour')
    expect(freePlanSummary(40)).toContain('sans oral')
  })

  it('rappelle au nouveau venu qu’une offre payante meilleure existe', async () => {
    await renderNotice({ status: 'essai', until: '2099-01-01', joursRestants: 7 })
    expect(
      await screen.findByText('Tu es dans l’offre gratuite', {}, { timeout: 3000 }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Il existe une offre payante bien meilleure'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Voir l’offre Premium/ })).toHaveAttribute(
      'href',
      '/premium',
    )
  })

  it('ne s’affiche pas pour un abonné', async () => {
    await renderNotice({ status: 'abonne', until: '2099-01-01', offerId: 'mensuel' })
    await new Promise((r) => setTimeout(r, 1500))
    expect(screen.queryByText('Tu es dans l’offre gratuite')).toBeNull()
  })
})

describe('date de fin de l’essai', () => {
  beforeEach(() => sessionStorage.clear())
  it('indique le jour exact de fin et le blocage sans paiement', async () => {
    await renderNotice({ status: 'essai', until: '2099-01-01T08:00:00.000Z', joursRestants: 3 })
    expect(
      await screen.findByText(/se termine le jeudi 1 janvier 2099 à 08:00/, {}, { timeout: 3000 }),
    ).toBeInTheDocument()
    expect(screen.getByText(/seule la page de paiement reste ouverte/)).toBeInTheDocument()
  })
})
