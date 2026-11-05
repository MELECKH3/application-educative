import { ShareSite } from '@/components/app/share-site'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  FileText,
  Lightbulb,
  MessageCircle,
  Mic,
  ShieldCheck,
  Timer,
} from 'lucide-react'
import { ExempleBadge, Logo } from '@/components/app/brand'
import { InstallAppButton } from '@/components/app/pwa'
import { Button } from '@/components/ui/button'
import {
  FREE_MINUTES_PER_DAY,
  OFFERS,
  VIP_WELCOME_DAYS,
  WHATSAPP_URL,
  formatFcfa,
  SITE_URL,
} from '@/lib/config'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Annales+ — Réussis ton CEPE, BEPC et BAC' },
      {
        name: 'description',
        content:
          'Sujets par niveau, leçons expliquées en 4 temps, tuteur IA socratique et oral en anglais, espagnol, allemand. Pensé pour les élèves de Côte d’Ivoire.',
      },
      {
        property: 'og:title',
        content: 'Annales+ — Réussis ton CEPE, BEPC et BAC',
      },
      {
        property: 'og:description',
        content:
          'Ton cahier de révision intelligent : sujets, leçons, tuteur IA et oral.',
      },
      {
        property: 'og:image',
        // Adresse complète : WhatsApp et Facebook n'affichent pas les images relatives.
        content: `${SITE_URL}/.netlify/images?url=/img/hero-eleve.png&w=1200&fm=jpg`,
      },
      { property: 'og:url', content: SITE_URL },
    ],
  }),
  component: Landing,
})

const FEATURES = [
  {
    icon: FileText,
    title: 'Des sujets à ton niveau',
    text: 'CEPE, BEPC, BAC et toutes les classes du CP1 à la Terminale, par série. Quatre niveaux : Fondations, Standard examen, Approfondissement, Olympiades.',
  },
  {
    icon: BookOpenCheck,
    title: 'Des leçons en 4 temps',
    text: 'Intuition tirée de la vie ivoirienne, mémo à retenir, exemple résolu, pièges fréquents. Puis un test de rappel pour vérifier que tu as compris.',
  },
  {
    icon: Lightbulb,
    title: 'Un tuteur qui te fait réfléchir',
    text: 'Il pose des questions et donne des indices avant la solution. Sept modes : expliquer, pas à pas, quiz, exercice similaire, corriger, résumé, discussion.',
  },
  {
    icon: Mic,
    title: 'L’oral en vrai',
    text: 'Un examinateur vocal en anglais, espagnol ou allemand. Tu choisis ton thème, tu réponds au micro, tu reçois une note sur 20 détaillée.',
  },
  {
    icon: Timer,
    title: 'Des examens blancs',
    text: 'Chronomètre, copie sur feuille lignée, sauvegarde automatique. Le corrigé s’ouvre 10 minutes après avoir rendu ta copie.',
  },
  {
    icon: ShieldCheck,
    title: 'Honnête et sûr',
    text: 'Un contenu d’entraînement est toujours marqué EXEMPLE. Jamais de fausse année ni de fausse source. L’IA reste dans le cadre scolaire.',
  },
]

function Landing() {
  return (
    <div className="min-h-svh">
      <header className="mx-auto flex h-16 max-w-content items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav aria-label="Navigation" className="flex items-center gap-2">
          <Link
            to="/premium"
            className="hidden min-h-11 items-center px-3 text-sm font-semibold text-muted-foreground hover:text-foreground sm:inline-flex"
          >
            Offres
          </Link>
          <Button asChild className="min-h-11 rounded-full px-5 font-bold">
            <Link to="/connexion" search={{ retour: '/accueil' }}>
              Commencer
            </Link>
          </Button>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-content items-center gap-10 px-4 pt-6 pb-16 sm:px-6 md:grid-cols-[1.05fr_1fr] md:pt-12">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-sm font-semibold text-secondary">
              <span aria-hidden="true">🇨🇮</span> Fait pour les élèves d’Afrique
              francophone
            </p>
            <h1 className="font-display text-4xl leading-[1.05] font-extrabold sm:text-5xl lg:text-6xl">
              Révise comme avec un{' '}
              <span className="text-primary">bon maître</span>, dans ta poche.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Annales+ t’accompagne pour le CEPE, le BEPC et le BAC — et dans
              toutes les classes. Des sujets à ton niveau, des leçons expliquées
              pas à pas, un tuteur IA qui te fait réfléchir et un simulateur
              d’oral.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="min-h-12 rounded-full px-7 text-base font-bold"
              >
                <Link to="/connexion" search={{ retour: '/accueil' }}>
                  Essayer {VIP_WELCOME_DAYS} jours VIP gratuits{' '}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="min-h-12 rounded-full px-6 text-base font-semibold"
              >
                <Link to="/explorer">Voir les sujets</Link>
              </Button>
              <InstallAppButton className="min-h-12 px-6 text-base" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Puis {FREE_MINUTES_PER_DAY} minutes gratuites chaque jour. Aucune
              carte bancaire.
            </p>
          </div>
          <div className="relative">
            <div
              className="absolute -inset-2 -rotate-2 rounded-[2rem] bg-primary/15 sm:-inset-3"
              aria-hidden="true"
            />
            <img
              src="/.netlify/images?url=/img/hero-eleve.png&w=900&fm=webp"
              srcSet="/.netlify/images?url=/img/hero-eleve.png&w=600&fm=webp 600w, /.netlify/images?url=/img/hero-eleve.png&w=900&fm=webp 900w, /.netlify/images?url=/img/hero-eleve.png&w=1200&fm=webp 1200w"
              sizes="(min-width: 768px) 50vw, 100vw"
              width={1200}
              height={896}
              alt="Une élève ivoirienne sourit en révisant dans son cahier, à côté de son téléphone."
              className="relative w-full rounded-[1.75rem] border border-border shadow-lg"
            />
          </div>
        </section>

        <section
          aria-labelledby="features"
          className="border-y border-border bg-card/60"
        >
          <div className="mx-auto max-w-content px-4 py-16 sm:px-6">
            <h2
              id="features"
              className="font-display text-3xl font-extrabold sm:text-4xl"
            >
              Tout ce qu’il faut pour réussir ton année
            </h2>
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <li
                  key={f.title}
                  className="rounded-2xl border border-border bg-background p-6 shadow-sm"
                >
                  <span className="grid size-11 place-items-center rounded-xl bg-primary/15 text-primary">
                    <f.icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-lg">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {f.text}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          aria-labelledby="honnete"
          className="mx-auto max-w-content px-4 py-16 sm:px-6"
        >
          <div className="grid items-center gap-8 rounded-2xl border border-border bg-card p-6 shadow-sm md:grid-cols-[1fr_auto] md:p-10">
            <div>
              <h2
                id="honnete"
                className="font-display text-2xl font-extrabold sm:text-3xl"
              >
                Notre règle d’or : ne jamais te tromper
              </h2>
              <p className="mt-3 max-w-2xl text-muted-foreground">
                Les épreuves officielles sont publiées seulement quand les
                droits le permettent. Tous les autres sujets sont des sujets
                d’entraînement originaux, clairement signalés par le badge{' '}
                <ExempleBadge className="align-middle" />. Aucune fausse année,
                aucune fausse source.
              </p>
            </div>
            <div className="rounded-2xl border border-dashed border-border bg-background p-4 text-sm">
              <div className="flex items-center gap-2">
                <ExempleBadge />
                <span className="font-semibold">Terminale D · Maths</span>
              </div>
              <p className="mt-2 font-display font-bold">
                Étude d’une fonction de production de cacao
              </p>
              <p className="text-muted-foreground">Niveau 2 · 60 min</p>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="offres"
          className="border-t border-border bg-card/60"
        >
          <div className="mx-auto max-w-content px-4 py-16 sm:px-6">
            <h2
              id="offres"
              className="font-display text-3xl font-extrabold sm:text-4xl"
            >
              Des offres simples, en FCFA
            </h2>
            <p className="mt-2 text-muted-foreground">
              Chaque abonnement est strictement personnel : un compte, un élève.
            </p>
            <div className="mt-8 grid gap-4 md:grid-cols-4">
              <OfferCard
                title="Bienvenue VIP"
                price="Gratuit"
                detail={`Illimité les ${VIP_WELCOME_DAYS} premiers jours`}
              />
              <OfferCard
                title="Gratuit"
                price="0 FCFA"
                detail={`${FREE_MINUTES_PER_DAY} minutes par jour, ensuite`}
              />
              {OFFERS.map((o) => (
                <OfferCard
                  key={o.id}
                  title={o.label}
                  price={formatFcfa(o.price)}
                  detail={`Illimité 24 h / 24 pendant ${o.durationLabel}`}
                  highlight={o.best}
                />
              ))}
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Paiement par Wave ou Orange Money.
            </p>
          </div>
        </section>
        <div className="mx-auto max-w-content px-4 pb-12 sm:px-6">
          <ShareSite />
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-content flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo className="text-base" />
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/professeurs" className="hover:text-foreground">
              Espace Professeurs
            </Link>
            <Link to="/confidentialite" className="hover:text-foreground">
              Confidentialité
            </Link>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <MessageCircle className="size-4" aria-hidden="true" /> Service
              client WhatsApp
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function OfferCard({
  title,
  price,
  detail,
  highlight,
}: {
  title: string
  price: string
  detail: string
  highlight?: boolean
}) {
  return (
    <div
      className={
        highlight
          ? 'relative rounded-2xl border-2 border-primary bg-background p-5 shadow-md'
          : 'rounded-2xl border border-border bg-background p-5 shadow-sm'
      }
    >
      {highlight && (
        <span className="absolute -top-3 left-5 rounded-full bg-primary px-3 py-0.5 text-xs font-bold text-primary-foreground">
          Meilleur prix
        </span>
      )}
      <p className="text-sm font-semibold text-muted-foreground">{title}</p>
      <p className="mt-1 font-display text-2xl font-extrabold">{price}</p>
      <p className="mt-2 flex items-start gap-1.5 text-sm">
        <Check
          className="mt-0.5 size-4 shrink-0 text-secondary"
          aria-hidden="true"
        />
        {detail}
      </p>
    </div>
  )
}
