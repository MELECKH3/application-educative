import { createFileRoute, Link } from '@tanstack/react-router'
import { GraduationCap } from 'lucide-react'
import { Logo } from '@/components/app/brand'
import { WHATSAPP_URL } from '@/lib/config'

export const Route = createFileRoute('/professeurs')({
  head: () => ({
    meta: [
      { title: 'Espace Professeurs — bientôt sur Annales+' },
      { name: 'description', content: 'L’Espace Professeurs arrive : classes, sujets A/B et suivi des élèves.' },
      { property: 'og:title', content: 'Espace Professeurs — Annales+' },
      { property: 'og:description', content: 'Bientôt : classes, sujets A/B, suivi des élèves.' },
    ],
  }),
  component: () => (
    <div className="min-h-svh">
      <header className="mx-auto flex h-16 max-w-content items-center px-4 sm:px-6">
        <Logo />
      </header>
      <main className="mx-auto max-w-reading px-4 py-16 text-center sm:px-6">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-secondary/15 text-secondary">
          <GraduationCap className="size-8" aria-hidden="true" />
        </span>
        <h1 className="mt-6 font-display text-3xl font-extrabold sm:text-4xl">Espace Professeurs</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Bientôt : l’Espace Professeurs arrive avec toutes ses fonctions (classes, sujets A/B, suivi des élèves). Inscris-toi pour être prévenu.
        </p>
        <a
          href={`${WHATSAPP_URL}?text=${encodeURIComponent('Bonjour, je suis professeur et je souhaite être prévenu de l’ouverture de l’Espace Professeurs Annales+.')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex min-h-12 items-center rounded-full bg-primary px-6 font-bold text-primary-foreground"
        >
          Être prévenu
        </a>
        <p className="mt-6">
          <Link to="/" className="text-sm font-semibold text-muted-foreground hover:text-foreground">Retour à l’accueil</Link>
        </p>
      </main>
    </div>
  ),
})
