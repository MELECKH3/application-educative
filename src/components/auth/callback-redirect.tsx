import { useEffect } from 'react'

// Identity emails and Google can return to the public homepage.
export function AuthCallbackRedirect() {
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1))
    if (
      window.location.pathname !== '/connexion' &&
      [
        'access_token',
        'confirmation_token',
        'recovery_token',
        'invite_token',
        'email_change_token',
        'error',
      ].some((key) => hash.has(key))
    ) {
      window.location.replace('/connexion' + window.location.hash)
    }
  }, [])
  return null
}
