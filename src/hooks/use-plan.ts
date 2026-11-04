import { useLoaderData } from '@tanstack/react-router'
import { isPremium, limitesFor, planOf } from '@/lib/access'

/** Formule de l'élève connecté (calculée par le serveur au chargement de l'espace élève). */
export function usePlan() {
  const billing = useLoaderData({ from: '/_app' })
  const access = billing?.access ?? null
  return {
    access,
    plan: planOf(access),
    premium: isPremium(access),
    limites: limitesFor(access),
  }
}
