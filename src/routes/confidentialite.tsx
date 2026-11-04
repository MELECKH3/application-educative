import { createFileRoute } from '@tanstack/react-router'
import { Logo } from '@/components/app/brand'
import { WHATSAPP_URL } from '@/lib/config'

export const Route = createFileRoute('/confidentialite')({
  head: () => ({
    meta: [
      { title: 'Confidentialité — Annales+' },
      {
        name: 'description',
        content: 'Comment Annales+ protège les données des élèves.',
      },
      { property: 'og:title', content: 'Confidentialité — Annales+' },
      {
        property: 'og:description',
        content:
          'Données minimales, protection des mineurs, demande de suppression de compte.',
      },
    ],
  }),
  component: () => (
    <div className="min-h-svh">
      <header className="mx-auto flex h-16 max-w-content items-center px-4 sm:px-6">
        <Logo />
      </header>
      <main className="mx-auto max-w-reading space-y-5 px-4 py-10 leading-relaxed sm:px-6">
        <h1 className="font-display text-3xl font-extrabold">
          Confidentialité
        </h1>
        <p>
          Annales+ est utilisé par des élèves, souvent mineurs. Nous collectons
          le minimum de données nécessaire.
        </p>
        <h2 className="text-xl">Ce que nous gardons</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Ton adresse e-mail de connexion, ton prénom, ta tranche d’âge, ton
            pays, ta classe, ta série et tes langues.
          </li>
          <li>
            Ta progression (sujets faits, scores, leçons) pour personnaliser tes
            révisions.
          </li>
          <li>
            Les reçus de paiement, stockés de façon privée, uniquement pour
            vérifier ton abonnement.
          </li>
        </ul>
        <h2 className="text-xl">Ce que nous ne gardons pas</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Les enregistrements audio de l’oral sont détruits juste après la
            transcription.
          </li>
          <li>Aucune donnée n’est revendue.</li>
        </ul>
        <h2 className="text-xl">Tes droits</h2>
        <p>
          Tu peux demander la suppression de ton compte depuis ton profil. Pour
          toute question, contacte le{' '}
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary underline"
          >
            service client sur WhatsApp
          </a>
          .
        </p>
      </main>
    </div>
  ),
})
