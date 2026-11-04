import { redirect } from '@tanstack/react-router'
import { getAccount } from './account.functions'
import { safeReturnTo } from './profile'

export async function requireStudent({
  location,
}: {
  location: { href: string }
}) {
  const account = await getAccount()
  const retour = safeReturnTo(location.href)
  if (!account) throw redirect({ to: '/connexion', search: { retour } })
  if (account.isAdmin) throw redirect({ to: '/admin', search: { page: 0 } })
  if (!account.profile) throw redirect({ to: '/bienvenue', search: { retour } })
  // Temps gratuit du jour épuisé sans abonnement : seule la page de paiement reste ouverte.
  if (account.access?.status === 'bloque')
    throw redirect({ to: '/premium', search: { raison: 'temps' } })
  return { account: { ...account, profile: account.profile } }
}
