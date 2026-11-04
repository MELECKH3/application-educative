import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  AuthError,
  acceptInvite,
  getSettings,
  getUser,
  handleAuthCallback,
  login,
  oauthLogin,
  refreshSession,
  requestPasswordRecovery,
  signup,
  updateUser,
} from '@netlify/identity'
import { Logo } from '@/components/app/brand'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { safeReturnTo } from '@/lib/profile'
import { ADMIN_EMAIL } from '@/lib/config'
import { createAccount } from '@/lib/account.functions'

export const Route = createFileRoute('/connexion')({
  validateSearch: (s: Record<string, unknown>) => ({
    retour: safeReturnTo(s.retour),
  }),
  head: () => ({
    meta: [
      { title: 'Connexion — Annales+' },
      {
        name: 'description',
        content:
          'Connecte-toi avec Google ou ton adresse e-mail pour retrouver ton profil élève.',
      },
      { property: 'og:title', content: 'Connexion — Annales+' },
      {
        property: 'og:description',
        content: 'Retrouve ton espace élève Annales+.',
      },
    ],
  }),
  component: Connexion,
})
export function Connexion() {
  const { retour } = Route.useSearch()
  const [mode, setMode] = useState<
    'login' | 'signup' | 'forgot' | 'reset' | 'invite'
  >('login')
  const [ready, setReady] = useState(false)
  const [google, setGoogle] = useState(false)
  const [signupAllowed, setSignupAllowed] = useState<boolean | null>(null)
  const [inviteToken, setInviteToken] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => {
    let active = true
    async function init() {
      try {
        const hash = new URLSearchParams(window.location.hash.slice(1))
        if (hash.has('error')) {
          window.history.replaceState(
            null,
            '',
            window.location.pathname + window.location.search,
          )
          setError('La connexion a été annulée ou refusée. Tu peux réessayer.')
        }
        const callback = await handleAuthCallback()
        if (!active) return
        if (callback?.type === 'recovery' || callback?.type === 'invite') {
          setMode(callback.type === 'invite' ? 'invite' : 'reset')
          if (callback.type === 'invite') {
            if (!callback.token) throw new Error('Invitation invalide.')
            setInviteToken(callback.token)
          }
          setReady(true)
          return
        }
        const user = await getUser()
        // Garde-fou : si le serveur a déjà renvoyé ici il y a quelques secondes, on n'insiste pas.
        const lastJump = Number(sessionStorage.getItem('annales-saut') || 0)
        const looping = Date.now() - lastJump < 15000
        if (user?.confirmedAt && !looping) {
          // Jeton expiré (onglet resté ouvert plus d'une heure) : on le renouvelle avant de repartir.
          try {
            await refreshSession()
          } catch {
            // Le serveur tentera aussi de renouveler la session.
          }
          if (!active) return
          sessionStorage.setItem('annales-saut', String(Date.now()))
          const target = safeReturnTo(
            sessionStorage.getItem('annales-retour') || retour,
          )
          sessionStorage.removeItem('annales-retour')
          window.location.replace(
            user.email?.toLowerCase() === ADMIN_EMAIL ? '/admin' : target,
          )
          return
        }
        if (user && looping) {
          sessionStorage.removeItem('annales-saut')
          setError(
            'Ta session n’a pas pu être ouverte. Entre à nouveau ton adresse et ton mot de passe.',
          )
        }
        const settings = await getSettings()
        if (active) {
          setGoogle(settings.providers.google)
          setSignupAllowed(!settings.disableSignup)
          setReady(true)
        }
      } catch {
        if (active) {
          setError(
            'La connexion est indisponible pour le moment. Réessaie dans quelques instants.',
          )
          setReady(true)
        }
      }
    }
    void init()
    return () => {
      active = false
    }
  }, [retour])
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const fields = new FormData(event.currentTarget)
    const email = String(fields.get('email') || '').trim()
    const password = String(fields.get('password') || '')
    setPending(true)
    setError('')
    setMessage('')
    try {
      sessionStorage.setItem('annales-retour', retour)
      if (mode === 'forgot') {
        await requestPasswordRecovery(email)
        setMessage(
          'Si un compte correspond à cette adresse, tu recevras un lien pour réinitialiser ton mot de passe.',
        )
      } else if (mode === 'signup') {
        const created = await createAccount({ data: { email, password } })
        if (created.status === 'closed') {
          setError(
            'Les inscriptions sont momentanément fermées. Réessaie un peu plus tard.',
          )
          return
        }
        if (created.status === 'exists') {
          setError(
            'Un compte existe déjà avec cette adresse. Choisis « J’ai déjà un compte » pour te connecter, ou « Mot de passe oublié ? ».',
          )
          return
        }
        if (created.status === 'created') {
          await login(email, password)
          sessionStorage.removeItem('annales-saut')
          window.location.assign(retour)
          return
        }
        const user = await signup(email, password)
        if (user.confirmedAt) window.location.assign(retour)
        else
          setMessage(
            'Consulte ta boîte e-mail et confirme ton adresse avant de te connecter.',
          )
      } else {
        if (mode === 'invite') await acceptInvite(inviteToken, password)
        else if (mode === 'reset') await updateUser({ password })
        else {
          try {
            await login(email, password)
          } catch (error) {
            // Compte créé autrefois mais jamais confirmé : on l'active directement.
            const detail =
              error instanceof AuthError ? error.message.toLowerCase() : ''
            if (
              !detail.includes('not confirmed') &&
              !detail.includes('not verified')
            )
              throw error
            const activated = await createAccount({ data: { email, password } })
            if (activated.status !== 'created') throw error
            await login(email, password)
          }
        }
        sessionStorage.removeItem('annales-saut')
        const connected = await getUser()
        window.location.assign(
          connected?.email?.toLowerCase() === ADMIN_EMAIL ? '/admin' : retour,
        )
      }
    } catch (error) {
      const detail =
        error instanceof AuthError ? error.message.toLowerCase() : ''
      if (detail.includes('not confirmed') || detail.includes('not verified')) {
        setError(
          'Confirme ton adresse avec le lien reçu par e-mail, puis reviens te connecter. Vérifie aussi les courriers indésirables.',
        )
      } else if (detail.includes('invalid') && mode === 'login') {
        setError(
          'Adresse ou mot de passe incorrect. Utilise le mot de passe de ton compte Annales+. Si tu n’as pas encore de compte, choisis « Créer un compte ». Sinon, utilise « Mot de passe oublié ? ».',
        )
      } else if (error instanceof AuthError && error.status === 429) {
        setError(
          'Trop de tentatives. Patiente quelques minutes avant de réessayer.',
        )
      } else {
        setError(
          'Impossible de terminer cette demande. Réessaie ou utilise « Mot de passe oublié ? » si tu as déjà un compte.',
        )
      }
    } finally {
      setPending(false)
    }
  }
  return (
    <main className="mx-auto min-h-svh max-w-lg space-y-7 px-4 py-10">
      <Logo />
      <section className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div>
          <p className="font-semibold text-secondary">Ton carnet de révision</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold">
            {mode === 'invite'
              ? 'Accepte ton invitation'
              : mode === 'reset'
                ? 'Nouveau mot de passe'
                : mode === 'forgot'
                  ? 'Mot de passe oublié'
                  : mode === 'signup'
                    ? 'Crée ton compte'
                    : 'Content de te retrouver'}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {mode === 'signup'
              ? 'Ton adresse Gmail et un mot de passe suffisent : ton compte est ouvert tout de suite.'
              : mode === 'forgot'
                ? 'Indique l’adresse utilisée pour ton compte Annales+.'
                : 'Entre ton adresse e-mail (Gmail acceptée) et ton mot de passe Annales+.'}
          </p>
        </div>
        {(mode === 'login' || mode === 'signup') && (
          <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
            {mode === 'login'
              ? 'Première visite ? Choisis « Créer un compte » ci-dessous. Le mot de passe demandé est celui d’Annales+, pas celui de ta boîte Gmail.'
              : 'Choisis un mot de passe d’au moins 8 caractères, différent de celui de ta boîte Gmail.'}
          </p>
        )}
        <form onSubmit={submit} className="space-y-4">
          <fieldset disabled={pending || !ready} className="space-y-4">
            {mode !== 'reset' && mode !== 'invite' && (
              <label className="block space-y-2 font-semibold">
                Adresse e-mail
                <Input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="min-h-11"
                />
              </label>
            )}
            {mode !== 'forgot' && (
              <label className="block space-y-2 font-semibold">
                Mot de passe
                <Input
                  name="password"
                  type="password"
                  minLength={mode === 'login' ? undefined : 8}
                  autoComplete={
                    mode === 'login' ? 'current-password' : 'new-password'
                  }
                  required
                  className="min-h-11"
                />
              </label>
            )}
            <Button type="submit" className="min-h-11 w-full rounded-full">
              {pending
                ? 'Patiente…'
                : mode === 'forgot'
                  ? 'Recevoir le lien'
                  : mode === 'invite'
                    ? 'Activer mon compte'
                    : mode === 'reset'
                      ? 'Enregistrer le mot de passe'
                      : mode === 'signup'
                        ? 'Créer mon compte'
                        : 'Me connecter'}
            </Button>
          </fieldset>
        </form>
        {google && mode === 'login' && (
          <>
            <p className="text-center text-sm text-muted-foreground">
              ou connecte-toi avec Google
            </p>
            <Button
              className="min-h-11 w-full rounded-full"
              disabled={!ready || pending || !google}
              onClick={async () => {
                setPending(true)
                setError('')
                try {
                  sessionStorage.setItem('annales-retour', retour)
                  oauthLogin('google')
                } catch (error) {
                  if (
                    error instanceof AuthError &&
                    error.message === 'Redirecting to OAuth provider'
                  )
                    return
                  setError('La connexion Google a échoué. Réessaie.')
                  setPending(false)
                }
              }}
            >
              {!ready
                ? 'Chargement…'
                : pending
                  ? 'Connexion en cours…'
                  : 'Continuer avec Google'}
            </Button>
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="text-sm text-secondary">
            {message}
          </p>
        )}
        {mode !== 'reset' && mode !== 'invite' && (
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <button
              type="button"
              disabled={pending || !ready || !signupAllowed}
              className="min-h-11 font-semibold text-primary"
              onClick={() => {
                setMode(mode === 'signup' ? 'login' : 'signup')
                setMessage('')
                setError('')
              }}
            >
              {mode === 'signup' ? 'J’ai déjà un compte' : 'Créer un compte'}
            </button>
            <button
              type="button"
              disabled={pending || !ready}
              className="min-h-11 text-muted-foreground"
              onClick={() => {
                setMode(mode === 'forgot' ? 'login' : 'forgot')
                setMessage('')
                setError('')
              }}
            >
              {mode === 'forgot'
                ? 'Retour à la connexion'
                : 'Mot de passe oublié ?'}
            </button>
          </div>
        )}
        {ready &&
          signupAllowed === false &&
          mode !== 'reset' &&
          mode !== 'invite' && (
            <p className="text-sm text-muted-foreground">
              Les inscriptions sont fermées pour le moment. Tu peux te connecter
              à ton compte existant.
            </p>
          )}
        <p className="text-sm text-muted-foreground">
          Tes informations servent à ton parcours scolaire.{' '}
          <Link to="/confidentialite" className="underline">
            Confidentialité
          </Link>
        </p>
      </section>
    </main>
  )
}
