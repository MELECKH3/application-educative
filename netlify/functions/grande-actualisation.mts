import { getDatabase } from '@netlify/database'
import { getSetting, queueRun } from '../../src/lib/sujets.server'

// Grande Actualisation : chaque nuit à 03h00 (Abidjan = UTC). Elle complète et renouvelle les
// sujets de chaque classe (objectif 1 000, chaque sujet est remplacé au bout de 7 jours), dans la
// limite du plafond quotidien réglé dans /admin. Les sujets remplacés sont archivés, pas supprimés.
export default async () => {
  if ((await getSetting('actualisation_pause')) === 'oui') return
  const db = getDatabase()
  const [running] = await db.sql<{ n: number }>`SELECT count(*)::int AS n FROM refresh_runs
    WHERE scope = 'toutes' AND status IN ('queued', 'running') AND created_at > now() - interval '20 minutes'`
  if (Number(running?.n ?? 0) > 0) return
  const origin = process.env.URL
  if (!origin) return
  await queueRun({ trigger: 'planifie', scope: 'toutes', origin })
}

export const config = { schedule: '0 3 * * *' }
