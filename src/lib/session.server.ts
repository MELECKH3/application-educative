import { admin, getUser } from '@netlify/identity'
import { getRequest } from '@tanstack/react-start/server'

type SessionUser = NonNullable<Awaited<ReturnType<typeof getUser>>>

// Marge avant expiration à partir de laquelle on renouvelle le jeton.
const REFRESH_MARGIN_S = 60

type NetlifyCookies = {
  get(name: string): string | undefined | null
  set(options: {
    name: string
    value: string
    path?: string
    secure?: boolean
    httpOnly?: boolean
    sameSite?: 'Lax' | 'Strict' | 'None'
  }): void
}
type NetlifyGlobal = {
  Netlify?: { context?: { cookies?: NetlifyCookies; url?: URL | string } }
  netlifyIdentityContext?: { url?: string }
}

export function decodeTokenPayload(token: string) {
  try {
    const payload = token.split('.')[1] ?? ''
    return JSON.parse(
      Buffer.from(
        payload.replace(/-/g, '+').replace(/_/g, '/'),
        'base64',
      ).toString('utf8'),
    ) as { sub?: unknown; exp?: unknown }
  } catch {
    return null
  }
}

/**
 * Renouvelle le jeton d'accès (`nf_jwt`, valable 1 h) avec `nf_refresh` lorsqu'il a expiré
 * ou va expirer. Les nouveaux cookies repartent avec la réponse. En cas d'échec, les cookies
 * ne sont pas effacés : un autre onglet a pu renouveler la session au même moment.
 */
let identityBase: string | null = null

async function refreshedToken() {
  const g = globalThis as NetlifyGlobal
  const cookies = g.Netlify?.context?.cookies
  if (!cookies) return null
  const access = cookies.get('nf_jwt')
  const refresh = cookies.get('nf_refresh')
  if (!access || !refresh) return null
  const exp = decodeTokenPayload(access)?.exp
  if (typeof exp === 'number' && exp - Date.now() / 1000 > REFRESH_MARGIN_S)
    return null
  const base =
    g.netlifyIdentityContext?.url ??
    (g.Netlify?.context?.url
      ? new URL('/.netlify/identity', g.Netlify.context.url).href
      : null)
  if (!base) return null
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh,
      }).toString(),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      access_token?: string
      refresh_token?: string
    }
    if (!data.access_token) return null
    identityBase = base
    const options = {
      path: '/',
      secure: true,
      httpOnly: false,
      sameSite: 'Lax' as const,
    }
    cookies.set({ name: 'nf_jwt', value: data.access_token, ...options })
    if (data.refresh_token)
      cookies.set({ name: 'nf_refresh', value: data.refresh_token, ...options })
    return data.access_token
  } catch {
    return null
  }
}

async function resolveSessionUser(): Promise<SessionUser | null> {
  const fresh = await refreshedToken()
  if (fresh) {
    // Jeton obtenu à l'instant auprès d'Identity : on lit le compte complet (rôles compris).
    const id = decodeTokenPayload(fresh)?.sub
    if (typeof id === 'string') {
      try {
        const user = await admin.getUser(id)
        if (user?.id) return user
      } catch {
        // Lecture directe du compte avec le nouveau jeton.
      }
    }
    if (identityBase) {
      try {
        const res = await fetch(`${identityBase.replace(/\/$/, '')}/user`, {
          headers: { Authorization: `Bearer ${fresh}` },
          signal: AbortSignal.timeout(8000),
        })
        if (res.ok) {
          const raw = (await res.json()) as {
            id?: string
            email?: string
            confirmed_at?: string
            user_metadata?: { full_name?: string; name?: string }
            app_metadata?: { roles?: string[] }
          }
          if (raw.id)
            return {
              id: raw.id,
              email: raw.email,
              confirmedAt: raw.confirmed_at,
              name: raw.user_metadata?.full_name ?? raw.user_metadata?.name,
              roles: Array.isArray(raw.app_metadata?.roles)
                ? raw.app_metadata.roles
                : [],
              userMetadata: raw.user_metadata ?? {},
              appMetadata: raw.app_metadata ?? {},
            } as SessionUser
        }
      } catch {
        // On retombe sur la lecture classique ci-dessous.
      }
    }
  }
  const user = await getUser()
  return user?.id ? user : null
}

// Une seule résolution par requête : le garde de route et le chargeur partagent le résultat,
// ce qui évite d'utiliser deux fois le même jeton de rafraîchissement.
const perRequest = new WeakMap<object, Promise<SessionUser | null>>()

/**
 * Utilisateur de la session en cours, côté serveur.
 * Identity ne délivre une session qu'aux comptes confirmés ; côté serveur, l'utilisateur
 * peut être reconstruit à partir du jeton, sans `confirmedAt`. Il ne faut donc pas exiger ce champ.
 */
export function sessionUser(): Promise<SessionUser | null> {
  let request: object | undefined
  try {
    request = getRequest()
  } catch {
    request = undefined
  }
  if (!request) return resolveSessionUser()
  let pending = perRequest.get(request)
  if (!pending) {
    pending = resolveSessionUser()
    perRequest.set(request, pending)
  }
  return pending
}
