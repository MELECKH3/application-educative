import { getDatabase } from '@netlify/database'

// Outils partagés de la console admin. Imports relatifs uniquement (aussi utilisé par les Netlify Functions).

/** Interrupteurs d'urgence, stockés dans app_settings (valeur « oui » = coupé). */
export const SWITCHES = {
  coupure_ia: 'Couper le tuteur et le Professeur IA',
  coupure_oral: 'Couper l’oral vocal',
  coupure_generation: 'Couper la génération de sujets',
  coupure_inscriptions: 'Fermer les inscriptions',
} as const
export type SwitchKey = keyof typeof SWITCHES

/** Un interrupteur est-il activé ? En cas d'erreur de lecture, le service reste ouvert. */
export async function switchOn(key: SwitchKey) {
  try {
    const db = getDatabase()
    const [row] = await db.sql<{
      value: string
    }>`SELECT value FROM app_settings WHERE key = ${key}`
    return row?.value === 'oui'
  } catch {
    return false
  }
}

export async function logAdmin(
  actorId: string,
  action: string,
  target?: string | null,
  details?: string | null,
) {
  const db = getDatabase()
  await db.sql`INSERT INTO admin_audit (id, actor_id, action, target, details)
    VALUES (${crypto.randomUUID()}, ${actorId}, ${action}, ${target ?? null}, ${details ?? null})`
}

export type Announcement = {
  message: string
  niveau: 'info' | 'alerte'
  fin: string | null
}

/** Annonce globale en cours (null si aucune ou expirée). */
export async function currentAnnouncement(): Promise<Announcement | null> {
  try {
    const db = getDatabase()
    const [row] = await db.sql<{
      value: string
    }>`SELECT value FROM app_settings WHERE key = 'annonce'`
    if (!row?.value) return null
    const a = JSON.parse(row.value) as Announcement
    if (!a?.message) return null
    if (a.fin && new Date(a.fin).getTime() < Date.now()) return null
    return a
  } catch {
    return null
  }
}

/** Échappe une valeur pour un fichier CSV (séparateur « ; », lisible par Excel en français). */
export function toCsv(header: string[], rows: unknown[][]) {
  const cell = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n')
}
