// Application installable (PWA) : installation sur l'écran d'accueil et détection des mises à jour.
// Côté navigateur uniquement ; tout est inerte au rendu serveur.

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type PwaState = {
  /** Fenêtre d'installation native disponible (Android, ordinateur). */
  canPrompt: boolean
  /** Déjà ouverte comme application installée. */
  installed: boolean
  /** iPhone / iPad : installation manuelle via « Partager → Sur l'écran d'accueil ». */
  ios: boolean
  /** Une nouvelle version a été publiée depuis l'ouverture de la page. */
  updateReady: boolean
}

const SERVER_STATE: PwaState = {
  canPrompt: false,
  installed: false,
  ios: false,
  updateReady: false,
}

let state: PwaState = SERVER_STATE
let deferred: InstallPromptEvent | null = null
let registration: ServiceWorkerRegistration | null = null
let started = false
const listeners = new Set<() => void>()

const set = (patch: Partial<PwaState>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
export const getSnapshot = () => state
export const getServerSnapshot = () => SERVER_STATE

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** Compare la version publiée à celle de la page ouverte. */
export const isNewVersion = (current: string, published: unknown) =>
  typeof published === 'string' && published.length > 0 && published !== current

async function checkVersion() {
  if (state.updateReady || !import.meta.env.PROD) return
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return
    const data = (await res.json()) as { version?: unknown }
    if (isNewVersion(__APP_VERSION__, data.version)) {
      set({ updateReady: true })
      registration?.update().catch(() => {})
    }
  } catch {
    // Pas de réseau : on réessaiera plus tard.
  }
}

/** À appeler une seule fois, au montage du document. */
export function startPwa() {
  if (started || typeof window === 'undefined') return
  started = true
  set({ installed: isStandalone(), ios: isIos() })

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallPromptEvent
    set({ canPrompt: true })
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    set({ canPrompt: false, installed: true })
  })

  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  navigator.serviceWorker
    .register('/sw.js', { scope: '/', updateViaCache: 'none' })
    .then((reg) => {
      registration = reg
    })
    .catch(() => {})

  // Vérifie les mises à jour au retour sur l'application et toutes les 30 minutes.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkVersion()
  })
  window.setInterval(() => void checkVersion(), 30 * 60 * 1000)
  window.setTimeout(() => void checkVersion(), 10_000)
}

/** Ouvre la fenêtre d'installation native. Renvoie true si l'élève a accepté. */
export async function promptInstall() {
  if (!deferred) return false
  const ev = deferred
  deferred = null
  set({ canPrompt: false })
  await ev.prompt()
  const { outcome } = await ev.userChoice
  if (outcome === 'accepted') set({ installed: true })
  return outcome === 'accepted'
}

/** Applique la mise à jour : nouveau service worker puis rechargement. */
export async function applyUpdate() {
  try {
    await registration?.update()
    registration?.waiting?.postMessage('SKIP_WAITING')
  } catch {
    // Le rechargement suffit : les pages sont toujours chargées en ligne.
  }
  window.location.reload()
}
