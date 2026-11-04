import { createFileRoute, Link } from '@tanstack/react-router'
import { logout } from '@netlify/identity'
import { useEffect, useState } from 'react'
import {
  ChevronRight,
  Crown,
  GraduationCap,
  Lightbulb,
  LogOut,
  MessageCircle,
  Moon,
  ShieldCheck,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useStudent } from '@/hooks/use-student'
import { BillingSummary } from '@/components/app/billing-summary'
import { IdeaBox } from '@/components/app/student-extras'
import { InstallAppCard } from '@/components/app/pwa'
import { getBilling } from '@/lib/billing.functions'
import {
  FREE_MINUTES_PER_DAY,
  LEVELS,
  VIP_WELCOME_DAYS,
  WHATSAPP_URL,
} from '@/lib/config'

export const Route = createFileRoute('/_app/profil')({
  loader: () => getBilling(),
  head: () => ({
    meta: [
      { title: 'Mon profil — Annales+' },
      {
        name: 'description',
        content:
          'Ta classe, ta série, tes langues, ton offre et tes réglages Annales+.',
      },
      { property: 'og:title', content: 'Mon profil — Annales+' },
      { property: 'og:description', content: 'Tes réglages Annales+.' },
    ],
  }),
  component: Profil,
})

function Profil() {
  const s = useStudent()
  const billing = Route.useLoaderData()
  const { account } = Route.useRouteContext()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [nuit, setNuit] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      setNuit(document.documentElement.classList.contains('dark')),
    )
    return () => cancelAnimationFrame(frame)
  }, [])

  const toggleNuit = (v: boolean) => {
    setNuit(v)
    document.documentElement.classList.toggle('dark', v)
    localStorage.setItem('annales-theme', v ? 'nuit' : 'jour')
  }

  return (
    <div className="mx-auto max-w-reading space-y-6">
      <section className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <span
          className="grid size-16 shrink-0 place-items-center rounded-2xl bg-primary font-display text-2xl font-extrabold text-primary-foreground"
          aria-hidden="true"
        >
          {s.firstName[0]}
        </span>
        <div>
          <h1 className="font-display text-2xl font-extrabold">
            {s.firstName}
          </h1>
          <p className="text-sm text-muted-foreground">{account.user.email}</p>
          <p className="text-muted-foreground">
            {s.classe} {s.serie} · {s.pays}
          </p>
          <p className="text-sm text-muted-foreground">{s.ageRange}</p>
          <Link
            to="/bienvenue"
            search={{ retour: '/profil' }}
            className="inline-flex min-h-11 items-center font-semibold text-primary underline"
          >
            Modifier mes informations
          </Link>
          <p className="text-sm text-muted-foreground">
            Langues : {s.langues.join(', ')} · Niveau préféré :{' '}
            {LEVELS[s.niveauPrefere - 1].label}
          </p>
        </div>
      </section>

      <BillingSummary billing={billing} />
      <InstallAppCard />
      <IdeaBox />

      <section className="rounded-2xl border-2 border-primary/50 bg-primary/5 p-5">
        <p className="text-sm font-semibold text-muted-foreground">Mon offre</p>
        <p className="mt-1 font-display text-xl font-bold">
          Les offres Annales+
        </p>
        <p className="text-sm text-muted-foreground">
          Accès illimité pendant tes {VIP_WELCOME_DAYS} premiers jours, puis{' '}
          {FREE_MINUTES_PER_DAY} minutes gratuites par jour.
        </p>
        <Link
          to="/premium"
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 font-bold text-primary-foreground"
        >
          <Crown className="size-4" aria-hidden="true" /> Voir les offres
          Premium
        </Link>
      </section>

      <section className="rounded-2xl border border-border bg-card p-2 shadow-sm">
        <div className="flex min-h-14 items-center justify-between gap-3 px-3">
          <Label
            htmlFor="nuit"
            className="flex items-center gap-3 text-base font-semibold"
          >
            <Moon className="size-5" aria-hidden="true" /> Mode « Encre de Nuit
            »
          </Label>
          <Switch id="nuit" checked={nuit} onCheckedChange={toggleNuit} />
        </div>
        <Row
          to="/oral"
          icon={<GraduationCap className="size-5" />}
          label="Simulateur d’oral"
        />
        <Row
          to="/professeurs"
          icon={<Lightbulb className="size-5" />}
          label="Espace Professeurs"
        />
        <Row
          to="/confidentialite"
          icon={<ShieldCheck className="size-5" />}
          label="Confidentialité"
        />
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-14 items-center justify-between gap-3 rounded-xl px-3 font-semibold hover:bg-muted"
        >
          <span className="flex items-center gap-3">
            <MessageCircle className="size-5" aria-hidden="true" /> Service
            client WhatsApp
          </span>
          <ChevronRight
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
        </a>
      </section>

      <section className="rounded-2xl border border-border bg-card p-2 shadow-sm">
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            setPending(true)
            setError('')
            try {
              await logout()
              window.location.assign('/connexion')
            } catch {
              setError('La déconnexion a échoué. Réessaie.')
              setPending(false)
            }
          }}
          className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 font-semibold hover:bg-muted"
        >
          <LogOut className="size-5" aria-hidden="true" /> Se déconnecter
        </button>
        <a
          href={
            WHATSAPP_URL +
            '?text=' +
            encodeURIComponent(
              'Bonjour, je souhaite demander la suppression de mon compte Annales+.',
            )
          }
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-14 items-center px-3 font-semibold text-destructive"
        >
          Demander la suppression de mon compte
        </a>
        {error && (
          <p role="alert" className="px-3 text-destructive">
            {error}
          </p>
        )}
      </section>
    </div>
  )
}

function Row({
  to,
  icon,
  label,
}: {
  to: '/oral' | '/professeurs' | '/confidentialite'
  icon: React.ReactNode
  label: string
}) {
  return (
    <Link
      to={to}
      className="flex min-h-14 items-center justify-between gap-3 rounded-xl px-3 font-semibold hover:bg-muted"
    >
      <span className="flex items-center gap-3">
        <span aria-hidden="true">{icon}</span> {label}
      </span>
      <ChevronRight
        className="size-4 text-muted-foreground"
        aria-hidden="true"
      />
    </Link>
  )
}
