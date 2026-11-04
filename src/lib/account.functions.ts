import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { profileSchema } from './profile'

export const getAccount = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { setResponseHeader } = await import('@tanstack/react-start/server')
    setResponseHeader('Cache-Control', 'private, no-store')
    const { sessionUser } = await import('./session.server')
    const user = await sessionUser()
    if (!user) return null
    const { db } = await import('../../db/index')
    const { profiles } = await import('../../db/schema')
    const { eq } = await import('drizzle-orm')
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, user.id))
      .limit(1)
    const { ADMIN_EMAIL } = await import('./config')
    const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
    const { studentAccess } = await import('./access.server')
    return {
      user: { name: user.name, email: user.email },
      // Le compte administrateur n'est jamais un compte élève : il est toujours dirigé vers /admin.
      isAdmin,
      access: profile && !isAdmin ? await studentAccess(user.id) : null,
      profile: profile
        ? {
            firstName: profile.firstName,
            ageRange: profile.ageRange,
            pays: profile.pays,
            classe: profile.classe,
            serie: profile.serie,
            langues: profile.langues,
            niveauPrefere: profile.niveauPrefere,
          }
        : null,
    }
  },
)

export const saveProfile = createServerFn({ method: 'POST' })
  .validator(profileSchema)
  .handler(async ({ data }) => {
    const { setResponseHeader } = await import('@tanstack/react-start/server')
    setResponseHeader('Cache-Control', 'private, no-store')
    const { sessionUser } = await import('./session.server')
    const user = await sessionUser()
    if (!user) throw new Error('Connecte-toi pour enregistrer ton profil.')
    const { db } = await import('../../db/index')
    const { profiles } = await import('../../db/schema')
    await db
      .insert(profiles)
      .values({ userId: user.id, ...data })
      .onConflictDoUpdate({
        target: profiles.userId,
        set: { ...data, updatedAt: new Date() },
      })
    return { saved: true }
  })

const accountSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(72),
})

/**
 * Crée un compte déjà confirmé : l'adresse e-mail et le mot de passe suffisent,
 * sans attendre le lien de confirmation. Un compte jamais confirmé (inscription
 * précédente restée en attente) est activé avec le nouveau mot de passe.
 * `fallback` signale que la création serveur est indisponible (inscription classique).
 */
export const createAccount = createServerFn({ method: 'POST' })
  .validator(accountSchema)
  .handler(async ({ data }) => {
    const { setResponseHeader } = await import('@tanstack/react-start/server')
    setResponseHeader('Cache-Control', 'private, no-store')
    const { admin, AuthError } = await import('@netlify/identity')
    const { ADMIN_EMAIL } = await import('./config')
    const { switchOn } = await import('./admin.server')
    if (await switchOn('coupure_inscriptions'))
      return { status: 'closed' as const }
    // L'adresse administrateur doit toujours confirmer sa boîte e-mail (inscription classique) :
    // l'accès admin automatique ne peut donc pas être pris par quelqu'un d'autre.
    if (data.email === ADMIN_EMAIL.toLowerCase())
      return { status: 'fallback' as const }
    try {
      await admin.createUser({ email: data.email, password: data.password })
      return { status: 'created' as const }
    } catch (error) {
      if (!(error instanceof AuthError) || error.status !== 422)
        return { status: 'fallback' as const }
    }
    // L'adresse existe déjà : on ne réactive qu'un compte jamais confirmé.
    try {
      for (let page = 1; page <= 50; page++) {
        const users = await admin.listUsers({ page, perPage: 100 })
        const match = users.find((u) => u.email?.toLowerCase() === data.email)
        if (match) {
          if (match.confirmedAt) return { status: 'exists' as const }
          await admin.updateUser(match.id, {
            password: data.password,
            confirm: true,
          })
          return { status: 'created' as const }
        }
        if (users.length < 100) break
      }
    } catch {
      return { status: 'fallback' as const }
    }
    return { status: 'exists' as const }
  })
