import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { Logo } from '@/components/app/brand'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AGE_RANGES,
  CLASSES,
  LANGUAGES,
  hasSerie,
  profileSchema,
  safeReturnTo,
} from '@/lib/profile'
import { getAccount, saveProfile } from '@/lib/account.functions'
import { LEVELS } from '@/lib/config'
import { SERIES_PAR_CLASSE } from '@/lib/curriculum'

export const Route = createFileRoute('/bienvenue')({
  validateSearch: (s: Record<string, unknown>) => ({
    retour: safeReturnTo(s.retour),
  }),
  beforeLoad: async ({ search }) => {
    const account = await getAccount()
    if (!account)
      throw redirect({ to: '/connexion', search: { retour: search.retour } })
    if (account.isAdmin) throw redirect({ to: '/admin', search: { page: 0 } })
    return { account }
  },
  head: () => ({
    meta: [
      { title: 'Ton profil élève — Annales+' },
      {
        name: 'description',
        content:
          'Renseigne ton prénom, ton pays, ta classe et tes langues en quatre étapes.',
      },
      { property: 'og:title', content: 'Ton profil élève — Annales+' },
      {
        property: 'og:description',
        content: 'Personnalise ton parcours de révision.',
      },
    ],
  }),
  component: Bienvenue,
})
const fieldClass =
  'min-h-11 w-full rounded-md border border-input bg-background px-3 text-foreground'
export function Bienvenue() {
  const { account } = Route.useRouteContext()
  const { retour } = Route.useSearch()
  const [step, setStep] = useState(0)
  const [values, setValues] = useState(
    account.profile || {
      firstName: account.user.name?.split(' ')[0] || '',
      ageRange: '',
      pays: '',
      classe: '',
      serie: '',
      langues: [] as string[],
      niveauPrefere: 2,
    },
  )
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const update = (key: string, value: string | number | string[]) =>
    setValues((v) => ({ ...v, [key]: value }))
  const titles = [
    'Comment t’appelles-tu ?',
    'Où étudies-tu ?',
    'Quelle est ta classe ?',
    'Comment veux-tu apprendre ?',
  ]
  async function next(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setError('')
    if (step < 3) {
      setStep(step + 1)
      return
    }
    const parsed = profileSchema.safeParse(values)
    if (!parsed.success) {
      setError('Vérifie les quatre étapes et choisis au moins une langue.')
      return
    }
    setPending(true)
    try {
      await saveProfile({ data: parsed.data })
      window.location.assign(retour)
    } catch {
      setError(
        'Ton profil n’a pas pu être enregistré. Tes réponses sont conservées ici : réessaie.',
      )
      setPending(false)
    }
  }
  return (
    <main className="mx-auto min-h-svh max-w-lg space-y-7 px-4 py-10">
      <Logo />
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <p className="font-semibold text-secondary">
          Ton profil · Étape {step + 1} sur 4
        </p>
        <ol aria-label="Étapes du profil" className="my-5 flex gap-2">
          {titles.map((t, i) => (
            <li
              key={t}
              aria-current={i === step ? 'step' : undefined}
              className={`h-2 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-muted'}`}
            >
              <span className="sr-only">{t}</span>
            </li>
          ))}
        </ol>
        <h1 className="mb-5 font-display text-2xl font-extrabold">
          {titles[step]}
        </h1>
        <form onSubmit={next} className="space-y-5">
          <fieldset disabled={pending} className="space-y-5">
            {step === 0 && (
              <>
                <label className="block space-y-2 font-semibold">
                  Ton prénom
                  <Input
                    required
                    maxLength={80}
                    autoComplete="given-name"
                    value={values.firstName}
                    onChange={(e) => update('firstName', e.target.value)}
                    className="min-h-11"
                  />
                </label>
                <label className="block space-y-2 font-semibold">
                  Ta tranche d’âge
                  <select
                    required
                    className={fieldClass}
                    value={values.ageRange}
                    onChange={(e) => update('ageRange', e.target.value)}
                  >
                    <option value="">Choisis ta tranche d’âge</option>
                    {AGE_RANGES.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <p className="text-sm text-muted-foreground">
                  Ta date de naissance exacte n’est pas demandée.
                </p>
              </>
            )}
            {step === 1 && (
              <label className="block space-y-2 font-semibold">
                Ton pays
                <Input
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="country-name"
                  value={values.pays}
                  onChange={(e) => update('pays', e.target.value)}
                  className="min-h-11"
                />
              </label>
            )}
            {step === 2 && (
              <>
                <label className="block space-y-2 font-semibold">
                  Ta classe
                  <select
                    required
                    className={fieldClass}
                    value={values.classe}
                    onChange={(e) => {
                      update('classe', e.target.value)
                      update('serie', '')
                    }}
                  >
                    <option value="">Choisis ta classe</option>
                    {CLASSES.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                {hasSerie(values.classe) && (
                  <label className="block space-y-2 font-semibold">
                    Ta série
                    <select
                      required
                      className={fieldClass}
                      value={values.serie}
                      onChange={(e) => update('serie', e.target.value)}
                    >
                      <option value="">Choisis ta série</option>
                      {[
                        ...(SERIES_PAR_CLASSE[values.classe] ?? []),
                        ...(values.serie &&
                        !SERIES_PAR_CLASSE[values.classe]?.includes(values.serie)
                          ? [values.serie]
                          : []),
                      ].map((v) => (
                        <option key={v} value={v}>
                          Série {v}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            )}
            {step === 3 && (
              <>
                <fieldset>
                  <legend className="mb-2 font-semibold">
                    Tes langues étudiées
                  </legend>
                  {LANGUAGES.map((v) => (
                    <label key={v} className="flex min-h-11 items-center gap-3">
                      <input
                        type="checkbox"
                        checked={values.langues.includes(v)}
                        onChange={(e) =>
                          update(
                            'langues',
                            e.target.checked
                              ? [...values.langues, v]
                              : values.langues.filter((l) => l !== v),
                          )
                        }
                      />
                      {v}
                    </label>
                  ))}
                </fieldset>
                <label className="block space-y-2 font-semibold">
                  Ton niveau préféré
                  <select
                    className={fieldClass}
                    value={values.niveauPrefere}
                    onChange={(e) =>
                      update('niveauPrefere', Number(e.target.value))
                    }
                  >
                    {LEVELS.map((v) => (
                      <option key={v.n} value={v.n}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <div className="flex gap-3">
              {step > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 rounded-full"
                  onClick={() => {
                    setStep(step - 1)
                    setError('')
                  }}
                >
                  Retour
                </Button>
              )}
              <Button type="submit" className="min-h-11 flex-1 rounded-full">
                {pending
                  ? 'Enregistrement…'
                  : step === 3
                    ? 'Enregistrer mon profil'
                    : 'Continuer'}
              </Button>
            </div>
          </fieldset>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
      </section>
    </main>
  )
}
