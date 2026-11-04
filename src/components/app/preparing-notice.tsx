import { useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'

/** Sujets de la classe en cours de génération : message + rechargement toutes les 20 s. */
export function PreparingNotice({
  preparing,
  classe,
  matiere,
}: {
  preparing: boolean
  classe: string
  matiere?: string
}) {
  const router = useRouter()
  useEffect(() => {
    if (!preparing) return
    const id = setInterval(() => void router.invalidate(), 20_000)
    return () => clearInterval(id)
  }, [preparing, router])
  if (!preparing) return null
  return (
    <p
      role="status"
      className="flex items-center gap-2 rounded-2xl border border-secondary/40 bg-secondary/10 px-4 py-3 text-sm"
    >
      <Loader2
        className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
        aria-hidden="true"
      />
      De nouveaux sujets de {classe} sont en préparation
      {matiere ? ` en ${matiere}` : ' pour tes matières'}. Ils apparaissent ici
      au fur et à mesure (en quelques minutes).
    </p>
  )
}
