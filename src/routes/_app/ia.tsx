import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { Camera, Crown, Flag, Loader2, RotateCcw, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ExempleBadge } from '@/components/app/brand'
import { cn } from '@/lib/utils'
import { tutorWelcome, type ChatMessage } from '@/lib/fixtures'
import { getSujet } from '@/lib/sujets.functions'
import { TUTOR_MODES } from '@/lib/config'
import { MAX_IMAGE_BYTES } from '@/lib/ai'
import { askTutor, reportAiAnswer } from '@/lib/ai.functions'
import { useStudent } from '@/hooks/use-student'

export const Route = createFileRoute('/_app/ia')({
  validateSearch: z.object({
    sujet: z.string().optional(),
    mode: z.enum(TUTOR_MODES).optional().catch(undefined),
  }),
  loaderDeps: ({ search }) => ({ sujet: search.sujet }),
  loader: async ({ deps }) =>
    deps.sujet ? getSujet({ data: { id: deps.sujet } }).catch(() => null) : null,
  head: () => ({
    meta: [
      { title: 'Tuteur IA — Annales+' },
      {
        name: 'description',
        content:
          'Un tuteur IA socratique qui te guide avec des questions et des indices progressifs, en 7 modes.',
      },
      { property: 'og:title', content: 'Tuteur IA — Annales+' },
      {
        property: 'og:description',
        content: 'Ton tuteur IA bienveillant, toujours dans le cadre scolaire.',
      },
    ],
  }),
  component: TutorRoute,
})

// Une conversation par sujet : changer de sujet repart d'un fil propre.
function TutorRoute() {
  const { sujet } = Route.useSearch()
  return <TutorPage key={sujet ?? 'libre'} />
}

type Mode = (typeof TUTOR_MODES)[number]
type Photo = { name: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp'; data: string; preview: string }

// Idées de questions proposées selon le mode, pour démarrer vite.
const SUGGESTIONS: Record<Mode, string[]> = {
  Expliquer: ['Explique-moi la dérivée avec un exemple', 'C’est quoi une suite géométrique ?', 'Explique-moi le dosage acido-basique'],
  'Pas à pas': ['Aide-moi à résoudre 2x² − 8x + 6 = 0', 'Guide-moi pour faire un tableau de variations', 'Aide-moi à construire un plan de dissertation'],
  Quiz: ['Fais-moi un quiz sur les dérivées', 'Quiz de 5 questions sur la génétique', 'Interroge-moi sur les indépendances africaines'],
  'Exercice similaire': ['Donne-moi un exercice sur les suites', 'Un exercice type BAC sur le circuit RC', 'Un exercice sur les nombres complexes'],
  'Corriger ma réponse': ['Voici ma réponse : f′(x) = 2x + 8. Est-ce juste ?', 'Corrige mon introduction de dissertation', 'Je t’envoie la photo de ma copie'],
  'Résumé de cours': ['Résume le chapitre sur la dérivation', 'Résumé de cours sur le dipôle RC', 'Résume la notion de bonheur en philosophie'],
  'Discussion libre': ['Comment bien réviser le BAC en un mois ?', 'J’ai du mal à me concentrer, que faire ?', 'Quelles études après un BAC D ?'],
}

function storageKey(sujetId?: string) {
  return `annales-tuteur-${sujetId ?? 'libre'}`
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function TutorPage() {
  const { sujet: sujetId, mode: initialMode } = Route.useSearch()
  const student = useStudent()
  const sujet = Route.useLoaderData() ?? undefined
  const welcome: ChatMessage[] = sujet
    ? [
        ...tutorWelcome,
        {
          role: 'tuteur',
          text: `On travaille sur « ${sujet.titre} ». Par quelle question veux-tu commencer ?`,
        },
      ]
    : [{ role: 'tuteur', text: `Bonjour ${student.firstName} ! ${tutorWelcome[0].text.replace(/^Bonjour ! /, '')}` }]
  const [mode, setMode] = useState<Mode>(initialMode ?? TUTOR_MODES[0])
  const [messages, setMessages] = useState<ChatMessage[]>(welcome)
  const [input, setInput] = useState('')
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [reported, setReported] = useState<number[]>([])
  const endRef = useRef<HTMLDivElement>(null)
  const restored = useRef(false)

  // Reprend la conversation en cours si l'élève change d'onglet puis revient.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const raw = sessionStorage.getItem(storageKey(sujetId))
        if (raw) {
          const saved = JSON.parse(raw) as { mode: Mode; messages: ChatMessage[] }
          if (TUTOR_MODES.includes(saved.mode)) setMode(saved.mode)
          if (Array.isArray(saved.messages) && saved.messages.length) setMessages(saved.messages)
        }
      } catch {
        // Conversation précédente illisible : on repart de zéro.
      }
      restored.current = true
    })
    return () => cancelAnimationFrame(frame)
  }, [sujetId])

  useEffect(() => {
    if (!restored.current) return
    try {
      sessionStorage.setItem(storageKey(sujetId), JSON.stringify({ mode, messages: messages.slice(-30) }))
    } catch {
      // Stockage plein ou désactivé : sans conséquence.
    }
  }, [messages, mode, sujetId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, pending])

  const send = async (override?: string) => {
    const text = (override ?? input).trim() || (photo ? 'Voici la photo de ma copie. Corrige-moi.' : '')
    if (!text || pending) return
    const next: ChatMessage[] = [...messages, { role: 'eleve', text: photo ? `📷 ${text}` : text }]
    setMessages(next)
    setInput('')
    setError('')
    setPending(true)
    const sentPhoto = photo
    setPhoto(null)
    try {
      const { reply } = await askTutor({
        data: {
          mode,
          sujetId: sujet?.id,
          messages: next.map((m) => ({ role: m.role, text: m.text.slice(0, 6000) })),
          image: sentPhoto ? { mediaType: sentPhoto.mediaType, data: sentPhoto.data } : undefined,
        },
      })
      setMessages((m) => [...m, { role: 'tuteur', text: reply }])
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'L’IA est momentanément indisponible. Réessaie.')
      setInput(text)
      setMessages(messages)
      if (sentPhoto) setPhoto(sentPhoto)
    } finally {
      setPending(false)
    }
  }

  const choosePhoto = async (file: File | undefined) => {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Choisis une photo JPG, PNG ou WebP.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Photo trop lourde : 4 Mo maximum. Recadre-la ou réduis sa qualité.')
      return
    }
    try {
      const url = await readFile(file)
      setPhoto({
        name: file.name,
        mediaType: file.type as Photo['mediaType'],
        data: url.slice(url.indexOf(',') + 1),
        preview: url,
      })
      setMode('Corriger ma réponse')
    } catch {
      toast.error('Impossible de lire cette photo. Réessaie.')
    }
  }

  const report = async (idx: number) => {
    if (reported.includes(idx)) return
    const answer = messages[idx]?.text ?? ''
    const question = [...messages.slice(0, idx)].reverse().find((m) => m.role === 'eleve')?.text
    try {
      await reportAiAnswer({ data: { kind: 'tuteur', question: question?.slice(0, 2000), answer: answer.slice(0, 6000) } })
      setReported((r) => [...r, idx])
      toast.success('Merci, la réponse a été signalée à l’équipe Annales+.')
    } catch {
      toast.error('Le signalement n’a pas pu être envoyé. Réessaie.')
    }
  }

  const reset = () => {
    setMessages(welcome)
    setError('')
    setReported([])
    try {
      sessionStorage.removeItem(storageKey(sujetId))
    } catch {
      // Rien à nettoyer.
    }
  }

  const onlyWelcome = messages.every((m) => m.role === 'tuteur')

  return (
    <div className="mx-auto flex max-w-reading flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Ton tuteur</h1>
          <p className="text-sm text-muted-foreground">
            Il te pose des questions et te donne des indices avant la solution, pour que tu apprennes vraiment.
          </p>
        </div>
        {!onlyWelcome && (
          <Button variant="outline" className="min-h-11 rounded-full" onClick={reset} disabled={pending}>
            <RotateCcw className="size-4" aria-hidden="true" /> Nouvelle conversation
          </Button>
        )}
      </div>

      {sujet && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
          <ExempleBadge />
          <span>
            Sujet : <span className="font-semibold">{sujet.titre}</span>
          </span>
          <Link to="/sujets/$sujetId" params={{ sujetId: sujet.id }} className="ml-auto font-semibold text-primary underline">
            Revoir l’énoncé
          </Link>
        </div>
      )}

      <div role="group" aria-label="Mode du tuteur" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {TUTOR_MODES.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center rounded-full border border-border bg-card px-4 text-sm font-semibold',
              mode === m && 'border-primary bg-primary text-primary-foreground',
            )}
          >
            {m}
          </button>
        ))}
      </div>

      <section aria-label="Conversation" aria-live="polite" aria-busy={pending} className="min-h-[50svh] space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        {messages.map((m, idx) => (
          <div key={idx} className={cn('flex', m.role === 'eleve' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-3 text-[0.95rem] leading-relaxed whitespace-pre-line break-words',
                m.role === 'eleve' ? 'rounded-br-md bg-ink text-ink-foreground' : 'rounded-bl-md border border-border bg-background',
              )}
            >
              {m.text}
              {m.role === 'tuteur' && idx >= welcome.length && (
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <button
                    type="button"
                    className="inline-flex min-h-8 items-center gap-1 font-semibold hover:text-foreground"
                    onClick={() => toast('« Voir les deux approches » arrive bientôt pour les abonnés Premium.')}
                  >
                    <Crown className="size-3.5" aria-hidden="true" /> Voir les deux approches
                  </button>
                  <button
                    type="button"
                    aria-label="Signaler cette réponse"
                    disabled={reported.includes(idx)}
                    className="inline-flex min-h-8 items-center gap-1 hover:text-foreground disabled:opacity-60"
                    onClick={() => void report(idx)}
                  >
                    <Flag className="size-3.5" aria-hidden="true" /> {reported.includes(idx) ? 'Signalée' : 'Signaler'}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {pending && (
          <div className="flex justify-start">
            <p role="status" className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Le tuteur réfléchit…
            </p>
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}
        {onlyWelcome && !pending && (
          <div className="pt-2">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Suggestions pour le mode « {mode} »</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS[mode].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="min-h-11 rounded-full border border-dashed border-primary/60 px-4 text-left text-sm hover:bg-primary/10"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </section>

      <form
        className="sticky bottom-20 flex flex-col gap-2 rounded-2xl border border-border bg-card p-2 shadow-md md:bottom-4"
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        {photo && (
          <div className="flex items-center gap-3 rounded-xl bg-muted px-3 py-2 text-sm">
            <img src={photo.preview} alt="" className="size-10 rounded-md object-cover" />
            <span className="min-w-0 flex-1 truncate">{photo.name}</span>
            <button type="button" aria-label="Retirer la photo" className="grid size-11 place-items-center rounded-lg hover:bg-background" onClick={() => setPhoto(null)}>
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <label className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl hover:bg-muted" aria-label="Envoyer une photo de copie">
            <Camera className="size-5" aria-hidden="true" />
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={pending}
              onChange={(e) => {
                void choosePhoto(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
          <label htmlFor="question" className="sr-only">
            Ta question
          </label>
          <textarea
            id="question"
            rows={1}
            value={input}
            maxLength={4000}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
            placeholder={`Mode « ${mode} » — écris ta question…`}
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 outline-none"
          />
          <Button type="submit" size="icon-lg" className="size-11 rounded-xl" aria-label="Envoyer" disabled={pending || (!input.trim() && !photo)}>
            {pending ? <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Send className="size-5" aria-hidden="true" />}
          </Button>
        </div>
      </form>
      <p className="text-center text-xs text-muted-foreground">
        L’IA peut se tromper : vérifie avec ton cours. Elle reste dans le cadre scolaire et ne remplace pas ton professeur.
      </p>
    </div>
  )
}
