import { getDatabase } from '@netlify/database'
import { sujets as apercus, type Sujet } from './fixtures'
import { matieresPour, normalizeSerie } from './curriculum'

// Accès aux sujets, partagé par les fonctions serveur et la Grande Actualisation.
// Imports relatifs uniquement : ce module est aussi empaqueté dans les Netlify Functions.

type Row = {
  id: string
  classe: string
  serie: string
  matiere: string
  niveau: number
  titre: string
  chapitre: string
  enonce: string
  bareme: string
  duree_min: number
}

const toSujet = (r: Row): Sujet => ({
  id: r.id,
  titre: r.titre,
  classe: r.classe,
  serie: r.serie || undefined,
  matiere: r.matiere,
  chapitre: r.chapitre,
  niveau: Math.min(4, Math.max(1, Number(r.niveau))) as Sujet['niveau'],
  dureeMin: Number(r.duree_min),
  enonce: r.enonce,
  bareme: r.bareme,
  exemple: true,
})

const sameClass = (s: Sujet, classe: string, serie: string) =>
  s.classe === classe && normalizeSerie(s.classe, s.serie ?? '') === serie

/** Un sujet par identifiant (aperçu ou base). Le corrigé n'est jamais renvoyé. */
export async function findSujet(id: string): Promise<Sujet | null> {
  const fixture = apercus.find((s) => s.id === id)
  if (fixture) return fixture
  if (!/^[0-9a-f-]{36}$/.test(id)) return null
  const db = getDatabase()
  const [row] =
    await db.sql<Row>`SELECT id, classe, serie, matiere, niveau, titre, chapitre, enonce, bareme, duree_min
    FROM subjects WHERE id = ${id}`
  return row ? toSujet(row) : null
}

/** Sujets de la classe de l'élève, filtrés par matière et niveau, du plus récent au plus ancien. */
export async function listForClass(opts: {
  classe: string
  serie: string
  matiere?: string
  niveau?: number
  limit: number
  offset: number
}) {
  const serie = normalizeSerie(opts.classe, opts.serie)
  const allowed = matieresPour(opts.classe, serie).map((m) => m.id)
  const matiere =
    opts.matiere && allowed.includes(opts.matiere) ? opts.matiere : null
  const niveau = opts.niveau ?? null
  const db = getDatabase()
  const rows =
    await db.sql<Row>`SELECT id, classe, serie, matiere, niveau, titre, chapitre, enonce, bareme, duree_min
    FROM subjects
    WHERE classe = ${opts.classe} AND serie = ${serie} AND archived_at IS NULL
      AND (${matiere}::text IS NULL OR matiere = ${matiere})
      AND (${niveau}::int IS NULL OR niveau = ${niveau})
    ORDER BY created_at DESC, id
    LIMIT ${opts.limit + 1} OFFSET ${opts.offset}`
  const counts = await db.sql<{
    matiere: string
    n: number
  }>`SELECT matiere, count(*)::int AS n
    FROM subjects
    WHERE classe = ${opts.classe} AND serie = ${serie} AND archived_at IS NULL
    GROUP BY matiere`
  const parMatiere: Record<string, number> = Object.fromEntries(
    allowed.map((m) => [m, 0]),
  )
  for (const c of counts)
    if (c.matiere in parMatiere) parMatiere[c.matiere] = Number(c.n)
  const count = { total: counts.reduce((t, c) => t + Number(c.n), 0) }
  const fixtures =
    opts.offset === 0
      ? apercus.filter(
          (s) =>
            sameClass(s, opts.classe, serie) &&
            (!matiere || s.matiere === matiere) &&
            (!niveau || s.niveau === niveau),
        )
      : []
  const list = [...rows.slice(0, opts.limit).map(toSujet), ...fixtures]
  return {
    sujets: list,
    hasMore: rows.length > opts.limit,
    matiere,
    parMatiere,
    totalClasse:
      Number(count?.total ?? 0) +
      apercus.filter((s) => sameClass(s, opts.classe, serie)).length,
  }
}

export async function getSetting(key: string) {
  const db = getDatabase()
  const [row] = await db.sql<{
    value: string
  }>`SELECT value FROM app_settings WHERE key = ${key}`
  return row?.value ?? null
}

export async function setSetting(key: string, value: string) {
  const db = getDatabase()
  await db.sql`INSERT INTO app_settings (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`
}

export const scopeOfClass = (classe: string, serie: string) =>
  `classe:${classe}|${serie}`
export const scopeOfMatiere = (
  classe: string,
  serie: string,
  matiere: string,
) => `matiere:${classe}|${serie}|${matiere}`
/** En dessous de ce nombre de sujets actifs, la première ouverture d'une matière lance sa génération. */
export const SEUIL_MATIERE = 8

/**
 * Crée une exécution en attente puis réveille la fonction d'arrière-plan.
 * Seul un identifiant créé ici (en base, statut « queued ») est accepté par la fonction :
 * personne ne peut déclencher de génération depuis l'extérieur.
 */
export async function queueRun(opts: {
  trigger: 'planifie' | 'admin' | 'eleve'
  scope: string
  origin: string
}) {
  const { switchOn } = await import('./admin.server')
  if (await switchOn('coupure_generation')) return null
  const db = getDatabase()
  const id = crypto.randomUUID()
  await db.sql`INSERT INTO refresh_runs (id, trigger, scope) VALUES (${id}, ${opts.trigger}, ${opts.scope})`
  try {
    const res = await fetch(
      new URL('/.netlify/functions/actualisation-background', opts.origin),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: id }),
        signal: AbortSignal.timeout(10000),
      },
    )
    if (!res.ok && res.status !== 202) throw new Error(`HTTP ${res.status}`)
  } catch {
    await db.sql`UPDATE refresh_runs SET status = 'failed', error = 'Démarrage impossible', finished_at = now()
      WHERE id = ${id} AND status = 'queued'`
    return null
  }
  return id
}

/**
 * Première ouverture d'une matière qui a moins de SEUIL_MATIERE sujets : on prépare ses sujets
 * tout de suite (16 sujets, un lot par niveau). Sans matière choisie, les 3 matières les moins
 * fournies de la classe sont préparées : dès la première connexion, chaque matière se remplit.
 * Garde-fous : une demande par matière toutes les 20 minutes, 30 par heure au total.
 */
export async function ensureClassSubjects(
  classe: string,
  serie: string,
  origin: string,
  opts: { matiere?: string | null; parMatiere: Record<string, number> },
) {
  const manquantes = Object.entries(opts.parMatiere)
    .filter(
      ([m, n]) => n < SEUIL_MATIERE && (!opts.matiere || m === opts.matiere),
    )
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([m]) => m)
  if (!manquantes.length) return false
  if ((await getSetting('actualisation_pause')) === 'oui') return false
  const db = getDatabase()
  const scopes = manquantes.map((m) => scopeOfMatiere(classe, serie, m))
  const recent = await db.sql<{
    scope: string
    trigger: string
  }>`SELECT scope, trigger FROM refresh_runs
    WHERE created_at > now() - interval '1 hour'`
  const since20 = await db.sql<{ scope: string }>`SELECT scope FROM refresh_runs
    WHERE created_at > now() - interval '20 minutes' AND scope = ANY(${scopes})`
  let hour = recent.filter((r) => r.trigger === 'eleve').length
  let pending = false
  for (const scope of scopes) {
    if (since20.some((r) => r.scope === scope)) {
      pending = true
      continue
    }
    if (hour >= 30) break
    hour++
    if (await queueRun({ trigger: 'eleve', scope, origin })) pending = true
  }
  return pending
}

/** Une exécution de la classe (ou de la matière) est-elle en cours ? (pour afficher « en préparation ») */
export async function classRunPending(
  classe: string,
  serie: string,
  matiere?: string | null,
) {
  const db = getDatabase()
  const prefix = matiere
    ? scopeOfMatiere(classe, serie, matiere)
    : `matiere:${classe}|${serie}|`
  const [row] = await db.sql<{
    n: number
  }>`SELECT count(*)::int AS n FROM refresh_runs
    WHERE status IN ('queued', 'running') AND created_at > now() - interval '30 minutes'
      AND (scope = ${scopeOfClass(classe, serie)} OR scope = 'toutes'
        OR (${matiere}::text IS NULL AND starts_with(scope, ${prefix})) OR scope = ${prefix})`
  return Number(row?.n ?? 0) > 0
}
