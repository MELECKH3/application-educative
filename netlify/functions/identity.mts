import { ADMIN_EMAIL } from '../../src/lib/config'
import { switchOn } from '../../src/lib/admin.server'

// Événements Netlify Identity.
// - Connexion de l'adresse administrateur confirmée : le rôle `admin` est ajouté au jeton tout de suite.
// - Interrupteur « Fermer les inscriptions » : les nouvelles inscriptions sont refusées.

type IdentityUser = {
  email?: string
  confirmedAt?: string | null
  appMetadata?: Record<string, unknown> & { roles?: string[] }
  [key: string]: unknown
}
type IdentityEvent = { user: IdentityUser; deny: () => unknown }

const isAdmin = (user: IdentityUser) =>
  !!user.email &&
  user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase() &&
  !!user.confirmedAt

function withAdminRole(user: IdentityUser) {
  const roles = Array.isArray(user.appMetadata?.roles)
    ? user.appMetadata.roles
    : []
  if (roles.includes('admin')) return undefined
  return {
    user: {
      ...user,
      appMetadata: { ...(user.appMetadata ?? {}), roles: [...roles, 'admin'] },
    },
  }
}

export default {
  async userValidate(event: IdentityEvent) {
    if (await switchOn('coupure_inscriptions')) return event.deny()
  },
  userSignup(event: IdentityEvent) {
    if (isAdmin(event.user)) return withAdminRole(event.user)
  },
  userLogin(event: IdentityEvent) {
    if (isAdmin(event.user)) return withAdminRole(event.user)
  },
}
