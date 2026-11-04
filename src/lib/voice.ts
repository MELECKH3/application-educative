// Synthèse vocale du navigateur : choix de la meilleure voix pour n'importe quelle langue,
// lecture phrase par phrase (évite les coupures de Chrome sur les longs textes).

export type VoiceLike = Pick<SpeechSynthesisVoice, 'name' | 'lang' | 'localService' | 'voiceURI'>

/** Voix de meilleure qualité (neuronales/naturelles) reconnues à leur nom. */
const QUALITY = [/natural/i, /neural/i, /online/i, /premium/i, /enhanced/i, /google/i, /siri/i, /wavenet/i]
const ROBOTIC = [/espeak/i, /compact/i, /novelty/i]

const norm = (lang: string) => lang.replace('_', '-').toLowerCase()

/** Score d'une voix pour une liste de codes de langue (ordre de préférence) ; -1 si elle ne parle pas la langue. */
export function voiceScore(v: VoiceLike, codes: readonly string[]) {
  const lang = norm(v.lang)
  const base = norm(codes[codes.length - 1]).split('-')[0]
  if (lang.split('-')[0] !== base) return -1
  let score = 10
  const exact = codes.findIndex((c) => norm(c) === lang)
  if (exact >= 0) score += 20 - exact * 2
  if (QUALITY.some((r) => r.test(v.name))) score += 25
  if (ROBOTIC.some((r) => r.test(v.name))) score -= 15
  return score
}

/** Voix proposées pour une langue, de la meilleure à la moins bonne. */
export function voicesFor<T extends VoiceLike>(voices: readonly T[], codes: readonly string[]): T[] {
  return voices
    .map((v) => ({ v, s: voiceScore(v, codes) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.v)
}

/** Découpe un texte en phrases courtes (toutes écritures : . ! ? 。 ！ ？ ؟ ।). */
export function splitSentences(text: string, max = 220): string[] {
  const parts = text
    .replace(/\s+/g, ' ')
    .trim()
    .match(/[^.!?。！？؟।…]+[.!?。！？؟।…]*["»”’)]*\s*/g)
  const out: string[] = []
  for (const raw of parts ?? []) {
    let p = raw.trim()
    while (p.length > max) {
      const cut = p.lastIndexOf(',', max) > 40 ? p.lastIndexOf(',', max) + 1 : p.lastIndexOf(' ', max)
      const at = cut > 20 ? cut : max
      out.push(p.slice(0, at).trim())
      p = p.slice(at).trim()
    }
    if (p) out.push(p)
  }
  return out
}

const hasSynth = () => typeof window !== 'undefined' && 'speechSynthesis' in window

/** Liste des voix, en attendant leur chargement (Chrome les charge après coup). */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!hasSynth()) return Promise.resolve([])
  const now = window.speechSynthesis.getVoices()
  if (now.length) return Promise.resolve(now)
  return new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', done)
      resolve(window.speechSynthesis.getVoices())
    }
    window.speechSynthesis.addEventListener('voiceschanged', done)
    setTimeout(done, 1500)
  })
}

let session = 0

export function stopSpeaking() {
  session++
  if (hasSynth()) window.speechSynthesis.cancel()
}

export type SpeakOptions = {
  codes: readonly string[]
  rate?: number
  /** Nom de la voix choisie par l'élève (sinon la meilleure disponible). */
  voiceName?: string
  onEnd?: () => void
}

/**
 * Lit le texte phrase par phrase avec la meilleure voix de la langue, puis appelle `onEnd`
 * (aussi si la lecture est impossible). Une nouvelle lecture interrompt la précédente.
 */
export function speakText(text: string, { codes, rate = 1, voiceName, onEnd }: SpeakOptions) {
  stopSpeaking()
  const id = session
  const finish = () => {
    if (id === session) onEnd?.()
  }
  if (!hasSynth() || !text.trim()) return finish()
  void loadVoices().then((voices) => {
    if (id !== session) return
    const ranked = voicesFor(voices, codes)
    const voice = ranked.find((v) => v.name === voiceName) ?? ranked[0]
    const sentences = splitSentences(text)
    let k = 0
    // Chrome met parfois la synthèse en pause : on la relance tant qu'il reste du texte.
    const keepAlive = setInterval(() => {
      if (id !== session) return clearInterval(keepAlive)
      if (window.speechSynthesis.paused) window.speechSynthesis.resume()
    }, 4000)
    const next = () => {
      if (id !== session) return clearInterval(keepAlive)
      if (k >= sentences.length) {
        clearInterval(keepAlive)
        return finish()
      }
      const u = new SpeechSynthesisUtterance(sentences[k++])
      u.lang = voice?.lang ?? codes[0]
      if (voice) u.voice = voice
      u.rate = rate
      let ended = false
      const go = () => {
        if (ended) return
        ended = true
        clearTimeout(guard)
        next()
      }
      // Filet de sécurité : certains appareils n'envoient jamais « end ».
      const guard = setTimeout(go, 2500 + u.text.length * 140 / rate)
      u.onend = go
      u.onerror = go
      window.speechSynthesis.speak(u)
    }
    next()
  })
}
