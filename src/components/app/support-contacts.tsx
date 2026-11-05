import { MessageCircle, Phone } from 'lucide-react'
import { SUPPORT_PHONES } from '@/lib/config'
import { cn } from '@/lib/utils'

/** Les deux numéros du service client : appel direct ou WhatsApp. */
export function SupportContacts({
  className,
  compact = false,
}: {
  className?: string
  compact?: boolean
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {!compact && (
        <p className="font-semibold">
          Service client — une question, un souci de paiement ?
        </p>
      )}
      <ul className="flex flex-wrap gap-2">
        {SUPPORT_PHONES.map((p) => (
          <li key={p.tel} className="flex flex-wrap items-center gap-1">
            <a
              href={`tel:${p.tel}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border px-3 text-sm font-semibold hover:bg-muted"
            >
              <Phone className="size-4" aria-hidden="true" /> {p.display}
            </a>
            <a
              href={p.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`WhatsApp ${p.display}`}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border text-secondary hover:bg-muted"
            >
              <MessageCircle className="size-4" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
