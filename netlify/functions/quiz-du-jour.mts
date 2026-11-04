import { getDatabase } from '@netlify/database'
import { normalizeSerie, SERIES_PAR_CLASSE, cycleOf } from '../../src/lib/curriculum'
import { ensureQuiz } from '../../src/lib/contenu.server'
import { quizDay } from '../../src/lib/quiz'

// Chaque nuit à 00h05 (Abidjan = UTC) : prépare le quiz du jour des classes qui ont des élèves.
// Les autres classes reçoivent le leur à la première visite (aucune dépense inutile).
export default async () => {
  const origin = process.env.URL
  if (!origin) return
  const db = getDatabase()
  const rows = await db.sql<{ classe: string; serie: string }>`SELECT DISTINCT classe, serie FROM profiles`
  const seen = new Set<string>()
  const day = quizDay()
  for (const r of rows) {
    const serie = normalizeSerie(r.classe, r.serie)
    if (cycleOf(r.classe) === 'lycee' && !SERIES_PAR_CLASSE[r.classe]?.includes(serie)) continue
    const key = `${r.classe}|${serie}`
    if (seen.has(key)) continue
    seen.add(key)
    await ensureQuiz(day, r.classe, serie, origin)
  }
}

export const config = { schedule: '5 0 * * *' }
