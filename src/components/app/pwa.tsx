import { useEffect, useState, useSyncExternalStore } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { Download, RefreshCw, Share, SquarePlus, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  applyUpdate,
  getServerSnapshot,
  getSnapshot,
  promptInstall,
  startPwa,
  subscribe,
} from '@/pwa/pwa'
import { cn } from '@/lib/utils'

export const usePwa = () =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

/** Monté une fois dans le document : enregistre le service worker et écoute l'installation. */
export function PwaStarter() {
  useEffect(() => startPwa(), [])
  return null
}

/** « Nouvelle version disponible » — jamais pendant une épreuve, pour ne pas perdre la copie. */
export function UpdateBanner() {
  const { updateReady } = usePwa()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [later, setLater] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!updateReady || later || pathname.startsWith('/examen')) return null
  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-20 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-ink p-3 pl-4 text-sm text-ink-foreground shadow-lg md:bottom-6"
    >
      <RefreshCw className="size-5 shrink-0" aria-hidden="true" />
      <p className="flex-1">
        <strong>Nouvelle version d’Annales+</strong>
        <span className="block opacity-80">
          Mets à jour pour profiter des nouveautés.
        </span>
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          void applyUpdate()
        }}
        className="min-h-11 rounded-full bg-primary px-4 font-bold text-primary-foreground disabled:opacity-70"
      >
        {busy ? 'Mise à jour…' : 'Mettre à jour'}
      </button>
      <button
        type="button"
        onClick={() => setLater(true)}
        aria-label="Plus tard"
        className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-ink-foreground/10"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}

/** Bouton « Installer l'application » ; aide pas à pas sur iPhone. Caché si déjà installée. */
export function InstallAppButton({ className }: { className?: string }) {
  const { canPrompt, installed, ios } = usePwa()
  const [help, setHelp] = useState(false)
  if (installed || (!canPrompt && !ios)) return null
  return (
    <>
      <button
        type="button"
        onClick={() => (canPrompt ? void promptInstall() : setHelp(true))}
        className={cn(
          'inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 font-bold text-ink-foreground shadow-sm transition-colors hover:bg-ink/90',
          className,
        )}
      >
        <Download className="size-4" aria-hidden="true" />
        Installer l’application
      </button>
      <IosInstallHelp open={help} onOpenChange={setHelp} />
    </>
  )
}

/** Carte d'installation pour l'espace élève (accueil, profil). */
export function InstallAppCard() {
  const { canPrompt, installed, ios } = usePwa()
  if (installed || (!canPrompt && !ios)) return null
  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <img
          src="/icons/icon-192.png"
          alt=""
          width={48}
          height={48}
          className="size-12 rounded-xl"
        />
        <div>
          <h2 className="font-display text-lg font-bold">
            Annales+ sur ton téléphone
          </h2>
          <p className="text-sm text-muted-foreground">
            Installe l’application : elle s’ouvre en un geste, prend très peu de
            place et se met à jour toute seule.
          </p>
        </div>
      </div>
      <InstallAppButton />
    </section>
  )
}

function IosInstallHelp({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Installer Annales+ sur iPhone</DialogTitle>
          <DialogDescription>
            Ouvre ce site dans Safari, puis suis ces deux étapes.
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-3 text-sm">
          <li className="flex items-center gap-3">
            <Share className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <span>
              1. Touche le bouton <strong>Partager</strong> en bas de l’écran.
            </span>
          </li>
          <li className="flex items-center gap-3">
            <SquarePlus
              className="size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span>
              2. Choisis <strong>Sur l’écran d’accueil</strong>, puis{' '}
              <strong>Ajouter</strong>.
            </span>
          </li>
        </ol>
        <p className="text-sm text-muted-foreground">
          L’icône Annales+ apparaît sur ton écran d’accueil. Les mises à jour
          arrivent automatiquement.
        </p>
      </DialogContent>
    </Dialog>
  )
}
