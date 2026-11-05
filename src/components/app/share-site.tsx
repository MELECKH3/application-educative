import { useState } from 'react'
import { Check, Copy, Share2 } from 'lucide-react'
import { SHARE_MESSAGE, SITE_URL } from '@/lib/config'
import { cn } from '@/lib/utils'

export const shareLinks = (url = SITE_URL, message = SHARE_MESSAGE) => {
  const text = encodeURIComponent(`${message} ${url}`)
  const u = encodeURIComponent(url)
  return {
    whatsapp: `https://wa.me/?text=${text}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    telegram: `https://t.me/share/url?url=${u}&text=${encodeURIComponent(message)}`,
    sms: `sms:?&body=${text}`,
  }
}

/** Carte « Partager Annales+ » : lien du site, partage natif, WhatsApp, Facebook, Telegram, SMS, copie. */
export function ShareSite({ className }: { className?: string }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const links = shareLinks()
  const copy = async () => {
    setError('')
    try {
      await navigator.clipboard.writeText(SITE_URL)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setError('Copie impossible : appuie longuement sur le lien pour le copier.')
    }
  }
  const nativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Annales+', text: SHARE_MESSAGE, url: SITE_URL })
      } catch {
        // Partage annulé par l'utilisateur.
      }
    } else void copy()
  }
  const btn =
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border px-4 text-sm font-semibold hover:bg-muted/60'
  return (
    <section
      aria-labelledby="partager-titre"
      className={cn('rounded-2xl border border-border bg-card p-5 shadow-sm', className)}
    >
      <h2 id="partager-titre" className="inline-flex items-center gap-2 font-display text-xl font-bold">
        <Share2 className="size-5 text-primary" aria-hidden="true" /> Partager Annales+
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Envoie le lien du site à tes camarades, ta famille ou ton groupe de classe.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-muted p-2">
        <a
          href={SITE_URL}
          className="min-w-0 flex-1 truncate px-2 font-mono text-sm font-semibold text-primary"
        >
          {SITE_URL.replace('https://', '')}
        </a>
        <button type="button" onClick={() => void copy()} className={cn(btn, 'bg-card')}>
          {copied ? (
            <>
              <Check className="size-4" aria-hidden="true" /> Lien copié
            </>
          ) : (
            <>
              <Copy className="size-4" aria-hidden="true" /> Copier le lien
            </>
          )}
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => void nativeShare()}
          className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground sm:col-span-3"
        >
          <Share2 className="size-4" aria-hidden="true" /> Partager le site
        </button>
        <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" className={btn}>
          WhatsApp
        </a>
        <a href={links.facebook} target="_blank" rel="noopener noreferrer" className={btn}>
          Facebook
        </a>
        <a href={links.telegram} target="_blank" rel="noopener noreferrer" className={btn}>
          Telegram
        </a>
        <a href={links.sms} className={btn}>
          SMS
        </a>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
