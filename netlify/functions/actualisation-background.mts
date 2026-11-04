import { getDatabase } from '@netlify/database'
import { executeRun } from '../../src/lib/generator.server'
import { getSetting, queueRun } from '../../src/lib/sujets.server'

// Fonction d'arrière-plan (15 min max) : génère les sujets d'une exécution réservée en base.
// Elle n'accepte qu'un identifiant créé côté serveur, encore en attente et récent.
// S'il reste du travail et du budget pour la journée, elle enchaîne une nouvelle exécution.
export default async (req: Request) => {
  const body = (await req.json().catch(() => null)) as { runId?: unknown } | null
  const runId = typeof body?.runId === 'string' ? body.runId : ''
  if (!/^[0-9a-f-]{36}$/.test(runId)) return
  const db = getDatabase()
  const [run] = await db.sql<{ scope: string; trigger: string }>`UPDATE refresh_runs SET status = 'running', started_at = now()
    WHERE id = ${runId} AND status = 'queued' AND created_at > now() - interval '10 minutes'
    RETURNING scope, trigger`
  if (!run) return
  try {
    const result = await executeRun(runId, run.scope, 14 * 60_000)
    const origin = process.env.URL
    if (result.canContinue && origin && (await getSetting('actualisation_pause')) !== 'oui') {
      await queueRun({ trigger: run.trigger === 'admin' ? 'admin' : 'planifie', scope: run.scope, origin })
    }
  } catch {
    await db.sql`UPDATE refresh_runs SET status = 'failed', error = 'Exécution interrompue', finished_at = now()
      WHERE id = ${runId} AND status = 'running'`
  }
}
