import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Languages, Lightbulb, Loader2, Mic, MicOff, Repeat, RotateCcw, Send, SkipForward, Square, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ORAL_THEMES } from '@/lib/config'
import { ORAL_LANGS, ORAL_LANG_IDS, oralLangInfo, oralPhase, type OralLang, type OralPhase } from '@/lib/ai'
import { loadVoices, speakText, stopSpeaking, voicesFor } from '@/lib/voice'
import { oralTurn } from '@/lib/ai.functions'
import { cleanTranscript, mergeResults } from '@/lib/dictee'
import { useNow } from '@/hooks/use-now'
import { usePlan } from '@/hooks/use-plan'
import { PremiumLockCard } from '@/components/app/premium-lock'

export const Route = createFileRoute('/_app/oral')({
  head: () => ({
    meta: [
      { title: 'Simulateur d’oral — Annales+' },
      {
        name: 'description',
        content:
          'Entraîne-toi à l’oral en anglais, espagnol, allemand, arabe, chinois et bien d’autres langues avec un examinateur IA : mains libres, voix naturelle, coups de pouce, corrections en direct et note sur 20.',
      },
      { property: 'og:title', content: 'Simulateur d’oral — Annales+' },
      { property: 'og:description', content: 'Oral dans la langue de ton choix avec un examinateur IA.' },
    ],
  }),
  component: OralPage,
})

const LANGS_PROGRAMME = ORAL_LANG_IDS.filter((id) => oralLangInfo(id).programme)
const LANGS_AUTRES = ORAL_LANG_IDS.filter((id) => !oralLangInfo(id).programme)
const NIVEAUX = ['Débutant', 'Intermédiaire', 'Examen'] as const
const DUREES = [3, 5, 10]

type Correction = { dit: string; correct: string; pourquoi: string }
type Turn = {
  role: 'examinateur' | 'eleve'
  text: string
  traduction?: string
  aide?: string[]
  correction?: Correction | null
}
type Evaluation = Extract<Awaited<ReturnType<typeof oralTurn>>, { type: 'evaluation' }>['evaluation']
type Vitesse = 'lente' | 'normale' | 'rapide'
const RATES: Record<Vitesse, number> = { lente: 0.8, normale: 1, rapide: 1.15 }
type Settings = {
  lang: OralLang
  theme: string
  niveau: (typeof NIVEAUX)[number]
  minutes: number
  vitesse: Vitesse
  /** Voix choisie par l'élève (sinon la plus naturelle disponible pour la langue). */
  voiceName?: string
  /** Mains libres : le micro s'ouvre après chaque question et la réponse part après un silence. */
  conversation: boolean
}
const PHASES: { id: OralPhase; label: string }[] = [
  { id: 'presentation', label: 'Présentation' },
  { id: 'echange', label: 'Échange sur le thème' },
  { id: 'conclusion', label: 'Conclusion' },
]
/** Silence après lequel la réponse dictée est envoyée en mode conversation. */
const SILENCE_MS = 1800

type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start(): void
  stop(): void
}
function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Lit le texte avec la meilleure voix de la langue (phrase par phrase), puis appelle `onEnd`. */
function speak(text: string, lang: OralLang, vitesse: Vitesse = 'normale', onEnd?: () => void, voiceName?: string) {
  speakText(text, { codes: ORAL_LANGS[lang].voices, rate: RATES[vitesse], voiceName, onEnd })
}

/** Voix disponibles sur l'appareil pour une langue, de la plus naturelle à la moins bonne. */
function useVoices(lang: OralLang | null) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  useEffect(() => {
    let alive = true
    void loadVoices().then((v) => alive && setVoices(v))
    const update = () => setVoices(window.speechSynthesis.getVoices())
    if (typeof window !== 'undefined' && 'speechSynthesis' in window)
      window.speechSynthesis.addEventListener('voiceschanged', update)
    return () => {
      alive = false
      if (typeof window !== 'undefined' && 'speechSynthesis' in window)
        window.speechSynthesis.removeEventListener('voiceschanged', update)
    }
  }, [])
  return lang ? voicesFor(voices, ORAL_LANGS[lang].voices) : []
}

function OralPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [round, setRound] = useState(0)
  const { premium } = usePlan()
  if (!premium)
    return (
      <div className="mx-auto max-w-reading space-y-6">
        <h1 className="font-display text-3xl font-extrabold">Simulateur d’oral</h1>
        <PremiumLockCard
          titre="Entraîne-toi à l’oral comme le jour J"
          texte="L’examinateur IA te parle à voix haute dans la langue de ton choix (anglais, espagnol, allemand, arabe, chinois…), attend ta réponse et te donne une note sur 20 détaillée."
          points={[
            'Thème, niveau et durée au choix',
            'Mains libres, coups de pouce et corrections en direct',
            'Note /20 sur 5 critères avec conseils',
          ]}
        />
      </div>
    )
  return settings ? (
    <OralSession
      key={JSON.stringify(settings) + String(round)}
      settings={settings}
      onExit={() => setSettings(null)}
      onRestart={() => setRound((r) => r + 1)}
    />
  ) : (
    <OralSetup onStart={setSettings} />
  )
}

function OralSetup({ onStart }: { onStart: (s: Settings) => void }) {
  const [lang, setLang] = useState<OralLang | null>(null)
  const [theme, setTheme] = useState<string | null>(null)
  const [niveau, setNiveau] = useState<Settings['niveau'] | null>(null)
  const [duree, setDuree] = useState<number | null>(null)
  const [vitesse, setVitesse] = useState<Vitesse>('normale')
  const [conversation, setConversation] = useState(true)
  const [voiceName, setVoiceName] = useState<string | undefined>(undefined)
  const [autres, setAutres] = useState(false)
  const [canListen] = useState(() => !!recognitionCtor())
  const voices = useVoices(lang)
  const l = lang ? oralLangInfo(lang) : null
  useEffect(() => () => stopSpeaking(), [])
  const pickLang = (id: OralLang) => {
    setLang(id)
    setVoiceName(undefined)
  }

  return (
    <div className="mx-auto max-w-reading space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold">Simulateur d’oral</h1>
        <p className="text-muted-foreground">
          Un examinateur IA te parle à voix haute, tu réponds au micro ou par écrit. Il attend toujours ta réponse.
        </p>
      </div>

      <Step n={1} title="Langue">
        {LANGS_PROGRAMME.map((id) => (
          <Choice key={id} active={lang === id} onClick={() => pickLang(id)}>
            <span aria-hidden="true">{oralLangInfo(id).flag}</span> {oralLangInfo(id).label}
          </Choice>
        ))}
        {(autres || (lang && !oralLangInfo(lang).programme)) ? (
          LANGS_AUTRES.map((id) => (
            <Choice key={id} active={lang === id} onClick={() => pickLang(id)}>
              <span aria-hidden="true">{oralLangInfo(id).flag}</span> {oralLangInfo(id).label}
            </Choice>
          ))
        ) : (
          <Choice active={false} onClick={() => setAutres(true)}>
            <Languages className="size-4" aria-hidden="true" /> Autres langues ({LANGS_AUTRES.length})
          </Choice>
        )}
      </Step>
      <Step n={2} title="Thème (obligatoire)">
        {ORAL_THEMES.map((t) => (
          <Choice key={t} active={theme === t} onClick={() => setTheme(t)}>
            {t}
          </Choice>
        ))}
      </Step>
      <Step n={3} title="Niveau">
        {NIVEAUX.map((t) => (
          <Choice key={t} active={niveau === t} onClick={() => setNiveau(t)}>
            {t}
          </Choice>
        ))}
      </Step>
      <Step n={4} title="Durée">
        {DUREES.map((d) => (
          <Choice key={d} active={duree === d} onClick={() => setDuree(d)}>
            {d} minutes
          </Choice>
        ))}
      </Step>
      <Step n={5} title="Voix de l’examinateur">
        <Choice active={vitesse === 'normale'} onClick={() => setVitesse('normale')}>
          Vitesse normale
        </Choice>
        <Choice active={vitesse === 'lente'} onClick={() => setVitesse('lente')}>
          Plus lente
        </Choice>
        <Choice active={vitesse === 'rapide'} onClick={() => setVitesse('rapide')}>
          Plus rapide
        </Choice>
        {canListen && (
          <Choice active={conversation} onClick={() => setConversation(!conversation)}>
            <Mic className="size-4" aria-hidden="true" /> Mains libres {conversation ? 'activé' : 'désactivé'}
          </Choice>
        )}
      </Step>
      {lang && l && (
        <div className="-mt-2 space-y-2 rounded-2xl border border-border bg-card p-4">
          {voices.length > 0 ? (
            <>
              <label htmlFor="voix-oral" className="text-sm font-semibold">
                Voix en {l.label.toLowerCase()} ({voices.length} sur ton appareil)
              </label>
              <div className="flex flex-wrap gap-2">
                <select
                  id="voix-oral"
                  value={voiceName ?? ''}
                  onChange={(e) => setVoiceName(e.target.value || undefined)}
                  className="min-h-11 flex-1 rounded-xl border border-border bg-background px-3 text-sm"
                >
                  <option value="">La plus naturelle ({voices[0].name})</option>
                  {voices.map((v) => (
                    <option key={v.voiceURI} value={v.name}>
                      {v.name} · {v.lang}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 rounded-full"
                  onClick={() => speak(l.hello, lang, vitesse, undefined, voiceName)}
                >
                  <Volume2 className="size-4" aria-hidden="true" /> Écouter
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Ton appareil n’a pas encore de voix en {l.label.toLowerCase()} : l’examinateur s’affichera par écrit.
              Pour l’entendre, ajoute cette langue dans les réglages « Synthèse vocale » de ton téléphone, ou utilise Chrome.
            </p>
          )}
        </div>
      )}
      {canListen && (
        <p className="-mt-3 text-xs text-muted-foreground">
          Mains libres : le micro s’ouvre tout seul après chaque question, et ta réponse part quand tu te tais
          2 secondes, et tu peux couper la parole à l’examinateur avec « À moi de parler », comme face à un vrai examinateur.
        </p>
      )}

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        {lang && theme && niveau && duree && l ? (
          <p className="text-sm text-muted-foreground">
            L’examinateur commencera par une salutation, par exemple :{' '}
            <span className="font-semibold text-foreground">« {l.hello} »</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Choisis la langue, le thème, le niveau et la durée pour commencer.</p>
        )}
        <Button
          size="lg"
          disabled={!(lang && theme && niveau && duree)}
          className="mt-4 min-h-12 w-full rounded-full text-base font-bold"
          onClick={() =>
            lang &&
            theme &&
            niveau &&
            duree &&
            onStart({ lang, theme, niveau, minutes: duree, vitesse, voiceName, conversation: conversation && canListen })
          }
        >
          <Mic className="size-5" aria-hidden="true" /> Commencer l’oral
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          Ta voix est transcrite par ton navigateur : aucun enregistrement audio n’est conservé par Annales+.
        </p>
      </div>
    </div>
  )
}

function OralSession({
  settings,
  onExit,
  onRestart,
}: {
  settings: Settings
  onExit: () => void
  onRestart: () => void
}) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [pending, setPendingState] = useState(false)
  const pendingRef = useRef(false)
  const setPending = (v: boolean) => {
    pendingRef.current = v
    setPendingState(v)
  }
  const [error, setError] = useState('')
  const [showFr, setShowFr] = useState<number[]>([])
  const [showAide, setShowAide] = useState<number[]>([])
  const [handsFree, setHandsFree] = useState(settings.conversation)
  const handsFreeRef = useRef(settings.conversation)
  const silence = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const inputRef = useRef('')
  const answerRef = useRef<() => void>(() => undefined)
  const listenRef = useRef<() => void>(() => undefined)
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const info = oralLangInfo(settings.lang)
  const say = (text: string, vitesse: Vitesse = settings.vitesse, onEnd?: () => void) => {
    recognition.current?.stop()
    setSpeaking(true)
    speak(
      text,
      settings.lang,
      vitesse,
      () => {
        setSpeaking(false)
        onEnd?.()
      },
      settings.voiceName,
    )
  }
  const [startedAt] = useState(() => Date.now())
  const recognition = useRef<Recognition | null>(null)
  const started = useRef(false)
  const endRef = useRef<HTMLDivElement>(null)
  const now = useNow(1000)
  // Session ouverte après un clic : on est forcément dans le navigateur.
  const [canListen] = useState(() => !!recognitionCtor())
  const remaining = now ? Math.max(0, settings.minutes * 60000 - (now.getTime() - startedAt)) : settings.minutes * 60000
  const timeUp = remaining === 0
  const elapsed = Math.round((settings.minutes * 60000 - remaining) / 1000)
  const phase = oralPhase(elapsed, settings.minutes)

  const call = async (history: Turn[], finish = false) => {
    setPending(true)
    setError('')
    try {
      const res = await oralTurn({
        data: {
          lang: settings.lang,
          theme: settings.theme,
          niveau: settings.niveau,
          minutes: settings.minutes,
          secondes: Math.min(3600, Math.round((Date.now() - startedAt) / 1000)),
          finish,
          messages: history.map((t) => ({ role: t.role, text: t.text.slice(0, 3000) })),
        },
      })
      if (res.type === 'evaluation') {
        setEvaluation(res.evaluation)
        handsFreeRef.current = false
        recognition.current?.stop()
        stopSpeaking()
        setSpeaking(false)
      } else {
        // La correction porte sur la dernière réponse de l'élève : elle s'affiche sous sa bulle.
        const next = history.map((t, k) =>
          k === history.length - 1 && t.role === 'eleve' ? { ...t, correction: res.turn.correction } : t,
        )
        setTurns([
          ...next,
          { role: 'examinateur', text: res.turn.say, traduction: res.turn.traduction, aide: res.turn.aide },
        ])
        say(res.turn.say, settings.vitesse, () => {
          if (handsFreeRef.current) listenRef.current()
        })
      }
      return true
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'L’examinateur est momentanément indisponible. Réessaie.')
      return false
    } finally {
      setPending(false)
    }
  }

  useEffect(() => {
    if (started.current) return
    started.current = true
    void call([])
    // eslint-disable-next-line react-hooks/exhaustive-deps -- premier tour une seule fois
  }, [])
  useEffect(
    () => () => {
      handsFreeRef.current = false
      if (silence.current) clearTimeout(silence.current)
      recognition.current?.stop()
      stopSpeaking()
    },
    [],
  )

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns, pending, evaluation])

  const updateInput = (value: string) => {
    inputRef.current = value
    setInput(value)
  }

  const answer = async () => {
    const text = cleanTranscript(inputRef.current)
    if (!text || pending) return
    if (silence.current) clearTimeout(silence.current)
    recognition.current?.stop()
    const history: Turn[] = [...turns, { role: 'eleve', text }]
    setTurns(history)
    updateInput('')
    const ok = await call(history)
    if (!ok) {
      setTurns(turns)
      updateInput(text)
    }
  }

  const startListening = () => {
    const Ctor = recognitionCtor()
    if (!Ctor || recognition.current) return
    stopSpeaking()
    setSpeaking(false)
    const r = new Ctor()
    r.lang = ORAL_LANGS[settings.lang].voice
    r.interimResults = true
    r.continuous = true
    const base = inputRef.current ? `${inputRef.current.trim()} ` : ''
    r.onresult = (e) => {
      const parts: string[] = []
      for (let k = 0; k < e.results.length; k++) parts.push(e.results[k][0].transcript)
      updateInput(cleanTranscript(base + mergeResults(parts)))
      // Mains libres : la réponse part après un court silence.
      if (silence.current) clearTimeout(silence.current)
      if (handsFreeRef.current)
        silence.current = setTimeout(() => answerRef.current(), SILENCE_MS)
    }
    let failed = false
    r.onend = () => {
      recognition.current = null
      setListening(false)
      // Mains libres : sur téléphone, la dictée s'arrête toute seule ; on la rouvre tant que rien n'est dit.
      if (handsFreeRef.current && !failed && !inputRef.current.trim() && !pendingRef.current)
        setTimeout(() => {
          if (handsFreeRef.current && !recognition.current && !pendingRef.current) listenRef.current()
        }, 300)
    }
    r.onerror = ((e?: { error?: string }) => {
      recognition.current = null
      setListening(false)
      // « no-speech » / « aborted » : simple silence, pas une panne du micro.
      if (e?.error === 'no-speech' || e?.error === 'aborted') return
      failed = true
      setError('Le micro n’est pas disponible. Autorise-le dans ton navigateur ou réponds par écrit.')
    }) as () => void
    // eslint-disable-next-line react-hooks/immutability -- ref mutée dans un gestionnaire, pas pendant le rendu.
    recognition.current = r
    setListening(true)
    try {
      r.start()
    } catch {
      recognition.current = null
      setListening(false)
    }
  }
  // Les rappels (fin de la voix, silence) utilisent toujours la dernière version de ces fonctions.
  useEffect(() => {
    answerRef.current = () => void answer()
    listenRef.current = startListening
  })

  /** Coupe la parole à l'examinateur et ouvre le micro tout de suite. */
  const interrupt = () => {
    stopSpeaking()
    setSpeaking(false)
    if (canListen) startListening()
  }

  const toggleMic = () => {
    if (listening) {
      if (silence.current) clearTimeout(silence.current)
      recognition.current?.stop()
      return
    }
    startListening()
  }

  const toggleHandsFree = () => {
    handsFreeRef.current = !handsFree
    setHandsFree(!handsFree)
    if (handsFree) {
      if (silence.current) clearTimeout(silence.current)
      recognition.current?.stop()
    }
  }

  const lastExaminer = [...turns].reverse().find((t) => t.role === 'examinateur')
  const studentTurns = turns.filter((t) => t.role === 'eleve').length

  return (
    <div className="mx-auto max-w-reading space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-secondary">
            Oral de {ORAL_LANGS[settings.lang].label.toLowerCase()} · {settings.theme} · {settings.niveau}
          </p>
          <h1 className="font-display text-2xl font-extrabold">Examinateur IA</h1>
        </div>
        <p
          className={cn('rounded-full border border-border px-4 py-2 font-mono text-sm font-semibold', timeUp && 'border-primary bg-primary/10')}
          aria-label="Temps restant"
        >
          {String(Math.floor(remaining / 60000)).padStart(2, '0')}:{String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')}
        </p>
      </div>

      {!evaluation && (
        <ol aria-label="Déroulé de l’oral" className="grid grid-cols-3 gap-2">
          {PHASES.map((p) => (
            <li
              key={p.id}
              aria-current={phase === p.id ? 'step' : undefined}
              className={cn(
                'rounded-xl border border-border px-2 py-2 text-center text-xs font-semibold text-muted-foreground',
                phase === p.id && 'border-primary bg-primary/10 text-foreground',
              )}
            >
              {p.label}
            </li>
          ))}
        </ol>
      )}

      <section aria-label="Conversation orale" aria-live="polite" className="min-h-[40svh] space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        {turns.map((t, idx) => (
          <div key={idx} className={cn('flex', t.role === 'eleve' ? 'justify-end' : 'justify-start')}>
            <div
              lang={t.role === 'examinateur' ? settings.lang : undefined}
              dir={t.role === 'examinateur' && info.rtl ? 'rtl' : undefined}
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-3 leading-relaxed whitespace-pre-line',
                t.role === 'eleve' ? 'rounded-br-md bg-ink text-ink-foreground' : 'rounded-bl-md border border-border bg-background',
              )}
            >
              {t.text}
              {t.role === 'eleve' && t.correction && (
                <p lang="fr" className="mt-2 rounded-lg bg-background/15 p-2 text-sm">
                  <span className="font-semibold">Correction : </span>
                  <span className="line-through opacity-80" lang={settings.lang}>{t.correction.dit}</span> →{' '}
                  <span className="font-semibold" lang={settings.lang}>{t.correction.correct}</span>
                  {t.correction.pourquoi && <span className="block opacity-90">{t.correction.pourquoi}</span>}
                </p>
              )}
              {t.role === 'examinateur' && showAide.includes(idx) && !!t.aide?.length && (
                <ul lang="fr" className="mt-2 space-y-1 border-t border-border pt-2 text-sm">
                  {t.aide.map((a) => (
                    <li key={a} className="flex gap-1.5">
                      <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
                      {a}
                    </li>
                  ))}
                </ul>
              )}
              {t.role === 'examinateur' && showFr.includes(idx) && t.traduction && (
                <p lang="fr" className="mt-2 border-t border-border pt-2 text-sm text-muted-foreground">
                  {t.traduction}
                </p>
              )}
              {t.role === 'examinateur' && (
                <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-muted-foreground">
                  <button type="button" className="inline-flex min-h-8 items-center gap-1 hover:text-foreground" onClick={() => say(t.text)}>
                    <Repeat className="size-3.5" aria-hidden="true" /> Répéter
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-8 items-center gap-1 hover:text-foreground"
                    onClick={() => say(t.text, 'lente')}
                  >
                    <Volume2 className="size-3.5" aria-hidden="true" /> Plus lentement
                  </button>
                  {!!t.aide?.length && (
                    <button
                      type="button"
                      className="inline-flex min-h-8 items-center gap-1 hover:text-foreground"
                      onClick={() => setShowAide((s) => (s.includes(idx) ? s.filter((x) => x !== idx) : [...s, idx]))}
                    >
                      <Lightbulb className="size-3.5" aria-hidden="true" />{' '}
                      {showAide.includes(idx) ? 'Masquer le coup de pouce' : 'Coup de pouce'}
                    </button>
                  )}
                  {t.traduction && (
                    <button
                      type="button"
                      className="inline-flex min-h-8 items-center gap-1 hover:text-foreground"
                      onClick={() => setShowFr((s) => (s.includes(idx) ? s.filter((x) => x !== idx) : [...s, idx]))}
                    >
                      <Languages className="size-3.5" aria-hidden="true" /> {showFr.includes(idx) ? 'Masquer la traduction' : 'Traduire'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {pending && (
          <p role="status" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            {evaluation ? '' : studentTurns > 0 && turns.at(-1)?.role === 'eleve' ? 'L’examinateur t’écoute…' : 'L’examinateur prépare sa question…'}
          </p>
        )}
        {(speaking || listening) && !evaluation && !pending && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/60 px-3 py-2 text-sm">
            <span className="relative flex size-3" aria-hidden="true">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-3 rounded-full bg-primary" />
            </span>
            <span role="status" className="font-semibold">
              {speaking ? 'L’examinateur parle…' : 'Je t’écoute, parle tranquillement…'}
            </span>
            {speaking && (
              <Button type="button" size="sm" variant="outline" className="ml-auto min-h-11 rounded-full" onClick={interrupt}>
                <SkipForward className="size-4" aria-hidden="true" /> {canListen ? 'À moi de parler' : 'Passer'}
              </Button>
            )}
          </div>
        )}
        {error && (
          <div role="alert" className="space-y-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <p>{error}</p>
            {turns.length === 0 && (
              <Button variant="outline" className="min-h-11 rounded-full" onClick={() => void call([])}>
                Réessayer
              </Button>
            )}
          </div>
        )}
        {evaluation && (
          <EvaluationCard
            evaluation={evaluation}
            lang={settings.lang}
            onListen={(text) => speak(text, settings.lang, 'lente', undefined, settings.voiceName)}
          />
        )}
        <div ref={endRef} />
      </section>

      {!evaluation ? (
        <>
          {timeUp && (
            <p className="rounded-xl bg-primary/10 px-4 py-3 text-sm font-semibold">
              Temps écoulé ! Termine ta phrase puis demande ta note.
            </p>
          )}
          <form
            className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-md"
            onSubmit={(e) => {
              e.preventDefault()
              void answer()
            }}
          >
            {canListen && (
              <Button
                type="button"
                variant={listening ? 'default' : 'outline'}
                size="icon-lg"
                className="size-11 shrink-0 rounded-xl"
                aria-label={listening ? 'Arrêter le micro' : 'Répondre au micro'}
                aria-pressed={listening}
                disabled={pending || !lastExaminer}
                onClick={toggleMic}
              >
                {listening ? <MicOff className="size-5" aria-hidden="true" /> : <Mic className="size-5" aria-hidden="true" />}
              </Button>
            )}
            <label htmlFor="reponse-oral" className="sr-only">
              Ta réponse
            </label>
            <textarea
              id="reponse-oral"
              lang={settings.lang}
              dir={info.rtl ? 'rtl' : undefined}
              rows={2}
              value={input}
              maxLength={3000}
              onChange={(e) => {
                if (silence.current) clearTimeout(silence.current)
                updateInput(e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void answer()
                }
              }}
              placeholder={listening ? (handsFree ? 'Parle : ta réponse part quand tu te tais…' : 'Parle, ta réponse s’écrit ici…') : `Réponds en ${ORAL_LANGS[settings.lang].label.toLowerCase()}…`}
              className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 outline-none"
            />
            <Button type="submit" size="icon-lg" className="size-11 shrink-0 rounded-xl" aria-label="Envoyer ma réponse" disabled={pending || !input.trim() || !lastExaminer}>
              <Send className="size-5" aria-hidden="true" />
            </Button>
          </form>
          {canListen && (
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-primary" checked={handsFree} onChange={toggleHandsFree} />
              Mains libres : micro automatique après chaque question, envoi après 2 secondes de silence
            </label>
          )}
          {!canListen && (
            <p className="text-xs text-muted-foreground">
              Ton navigateur ne propose pas la dictée vocale : réponds par écrit (mode écrit de secours).
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button className="min-h-11 rounded-full px-5 font-bold" disabled={pending || studentTurns === 0} onClick={() => void call(turns, true)}>
              <Square className="size-4" aria-hidden="true" /> Terminer et obtenir ma note
            </Button>
            <Button variant="outline" className="min-h-11 rounded-full" onClick={onExit}>
              Changer de réglages
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button className="min-h-11 rounded-full px-5 font-bold" onClick={onRestart}>
            <RotateCcw className="size-4" aria-hidden="true" /> Refaire sur le même thème
          </Button>
          <Button variant="outline" className="min-h-11 rounded-full" onClick={onExit}>
            Nouvel oral
          </Button>
        </div>
      )}
    </div>
  )
}

function EvaluationCard({
  evaluation,
  lang,
  onListen,
}: {
  evaluation: Evaluation
  lang: OralLang
  onListen: (text: string) => void
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-secondary/40 bg-secondary/10 p-5">
      <h2 className="font-display text-2xl font-extrabold">Ta note : {evaluation.note} / 20</h2>
      <ul className="space-y-2">
        {evaluation.criteres.map((c) => (
          <li key={c.nom} className="rounded-xl bg-background p-3">
            <p className="flex justify-between gap-3 font-semibold">
              <span>{c.nom}</span>
              <span>{c.note} / 4</span>
            </p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div className="h-full rounded-full bg-secondary" style={{ width: `${(c.note / 4) * 100}%` }} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{c.commentaire}</p>
          </li>
        ))}
      </ul>
      {evaluation.erreurs.length > 0 && (
        <div>
          <h3 className="font-semibold">Tes erreurs corrigées</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {evaluation.erreurs.map((e) => (
              <li key={e.dit} className="rounded-lg bg-background p-2">
                <span className="line-through text-muted-foreground" lang={lang}>{e.dit}</span> →{' '}
                <span className="font-semibold" lang={lang}>{e.correct}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {evaluation.modele && (
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            Ta réponse au niveau attendu
            <Button
              variant="ghost"
              size="icon"
              aria-label="Écouter la réponse modèle"
              onClick={() => onListen(evaluation.modele)}
            >
              <Volume2 className="size-4" aria-hidden="true" />
            </Button>
          </h3>
          <p lang={lang} dir={oralLangInfo(lang).rtl ? 'rtl' : undefined} className="paper-lined mt-1 rounded-xl p-3 text-sm leading-relaxed">
            {evaluation.modele}
          </p>
        </div>
      )}
      {evaluation.expressions.length > 0 && (
        <div>
          <h3 className="font-semibold">Expressions à réutiliser le jour J</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {evaluation.expressions.map((x) => (
              <li key={x}>
                <button
                  type="button"
                  onClick={() => onListen(x.replace(/\s*\(.*\)\s*$/, ''))}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-left text-sm"
                >
                  <Volume2 className="size-3.5 shrink-0" aria-hidden="true" />
                  {x}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p>
        <span className="font-semibold">Ta priorité pour le prochain oral : </span>
        {evaluation.conseil}
      </p>
      <p className="text-xs text-muted-foreground">Note indicative calculée par l’IA d’après la transcription.</p>
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-3 font-display text-lg font-bold">
        {n}. {title}
      </legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  )
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-sm font-semibold',
        active && 'border-primary bg-primary text-primary-foreground',
      )}
    >
      {children}
    </button>
  )
}
