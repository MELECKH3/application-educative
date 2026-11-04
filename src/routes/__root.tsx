import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

import { AuthCallbackRedirect } from '@/components/auth/callback-redirect'
import { SessionKeeper } from '@/components/auth/session-keeper'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { NotFoundPage } from '@/components/error-pages'
import { PwaStarter, UpdateBanner } from '@/components/app/pwa'

import '../styles.css'

const siteName = 'Annales+ — Réussis ton CEPE, BEPC et BAC'
const siteDescription =
  "Sujets d'entraînement, leçons expliquées par une IA, tuteur socratique et simulateur d'oral pour les élèves de Côte d'Ivoire et d'Afrique francophone."

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      {
        title: siteName,
      },
      {
        name: 'description',
        content: siteDescription,
      },
      {
        property: 'og:title',
        content: siteName,
      },
      {
        property: 'og:description',
        content: siteDescription,
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
      { name: 'theme-color', content: '#f7f1e3' },
      { name: 'application-name', content: 'Annales+' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-title', content: 'Annales+' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
    ],
    links: [
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'icon', type: 'image/svg+xml', href: '/icons/icon.svg' },
      { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&display=swap',
      },
    ],
    scripts: [
      {
        children:
          "try{if(localStorage.getItem('annales-theme')==='nuit')document.documentElement.classList.add('dark')}catch(e){}",
      },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFoundPage,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <AuthCallbackRedirect />
        <SessionKeeper />
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
        <PwaStarter />
        <UpdateBanner />
        <Scripts />
      </body>
    </html>
  )
}
