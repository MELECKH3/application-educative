import Anthropic from '@anthropic-ai/sdk'
import { getDatabase } from '@netlify/database'
import { z } from 'zod'
import { CLASSES } from './profile'
import { LEVELS } from './config'
import {
  CLASSES_EXAMEN,
  RENOUVELLEMENT_JOURS,
  SERIES_PAR_CLASSE,
  cycleOf,
  dureePour,
  examenOf,
  matiereById,
  normalizeSerie,
  quotasPour,
  type Cellule,
  type Quota,
} from './curriculum'
import { parseModelJson } from './ai'
import { generationParams } from './models'

// Générateur de la Grande Actualisation. Imports relatifs uniquement (Netlify Functions).
// Modèle puissant pour les classes d'examen et le lycée, modèle économique ailleurs.
export const GENERATOR_MODEL = 'claude-sonnet-5-5'
export const GENERATOR_MODEL_LEGER = 'claude-haiku-5-5'
const CONCURRENCY = 4
/** Sujets rédigés par appel au modèle : moins d'appels, donc moins de coût. */
export const SUJETS_PAR_APPEL = 4
/** Plafond quotidien par défaut (modifiable dans /admin), pour maîtriser la consommation d'IA. */
export const QUOTA_JOUR_DEFAUT = 300

export const modelPour = (classe: string) =>
  cycleOf(classe) === 'lycee' ||
  (CLASSES_EXAMEN as readonly string[]).includes(classe)
    ? GENERATOR_MODEL
    : GENERATOR_MODEL_LEGER

const generatedSchema = z.object({
  titre: z.string().trim().min(3).max(160),
  chapitre: z.string().trim().min(2).max(160),
  enonce: z.string().trim().min(40).max(7000),
  bareme: z.string().trim().min(3).max(600),
  corrige: z.string().trim().max(7000).default(''),
})

const LANG_NAME = { en: 'anglais', es: 'espagnol', de: 'allemand' } as const

export function generationPrompt(cell: Cellule, deja: string[], combien = 1) {
  const matiere = matiereById(cell.matiere)
  const level = LEVELS[cell.niveau - 1]
  const classe = `${cell.classe}${cell.serie ? ` série ${cell.serie}` : ''}`
  const cycle = cycleOf(cell.classe)
  const langue = matiere?.langue ? LANG_NAME[matiere.langue] : null
  return [
    `Tu es concepteur de sujets d'entraînement pour Annales+, plateforme de révision des élèves de Côte d'Ivoire. Rédige ${combien > 1 ? `${combien} sujets originaux et différents (chapitres ou situations variés)` : 'UN sujet original'} pour la classe de ${classe}, matière ${matiere?.nom ?? cell.matiere}, conforme au programme officiel ivoirien de cette classe (approche par compétences), préparant au ${examenOf(cell.classe)}.`,
    `Niveau ${cell.niveau}/4 « ${level.label} » : ${level.hint}. ${cell.niveau === 2 ? `Respecte le format et la longueur d'une épreuve type ${examenOf(cell.classe)} pour cette classe.` : ''} ${cell.niveau === 4 ? 'Très difficile, mais toujours dans les notions de cette classe.' : ''}`,
    cycle === 'primaire'
      ? 'Élève de primaire : consignes très courtes et claires, vocabulaire simple, nombres adaptés à son âge, situations du quotidien (marché, école, village, famille).'
      : 'Utilise des situations concrètes de la vie en Côte d’Ivoire et en Afrique de l’Ouest (prénoms, villes, produits, monnaie FCFA).',
    langue
      ? `Sujet de langue : l'énoncé (texte et consignes) est rédigé entièrement en ${langue}, au niveau attendu en ${classe}. Inclus le texte support complet (120 à 250 mots), écrit par toi.`
      : 'Si le sujet s’appuie sur un texte ou un document, écris-le en entier dans l’énoncé (document fictif clairement présenté comme tel). Ne renvoie jamais à un document « fourni en classe ».',
    `Interdits : année d'examen, mention « officiel », session, source ou auteur réel inventé, citation attribuée à une personne réelle. C'est un sujet d'entraînement.`,
    deja.length
      ? `Ne reprends pas ces sujets déjà proposés (choisis un autre chapitre ou une autre situation) :\n${deja.map((t) => `- ${t}`).join('\n')}`
      : '',
    `Le barème totalise 20 points et détaille chaque question. Le corrigé est complet mais concis (étapes clés et résultats).`,
    `Texte simple sans Markdown ni LaTeX (écris x², √, ≤, f′(x)). Questions numérotées 1., 2., … séparées par des retours à la ligne.`,
    `Réponds uniquement avec un objet JSON valide : {"sujets": [{"titre": "...", "chapitre": "...", "enonce": "...", "bareme": "...", "corrige": "..."}]} contenant exactement ${combien} sujet${combien > 1 ? 's' : ''}.`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

let client: Anthropic | null = null
const anthropic = () => (client ??= new Anthropic())

const today = () => new Date().toISOString().slice(0, 10)

/** Génère un lot de sujets pour une case, puis archive les plus anciens au-delà de l'objectif. */
async function generateBatch(cell: Quota, combien: number, runId: string) {
  const db = getDatabase()
  const deja = await db.sql<{ titre: string }>`SELECT titre FROM subjects
    WHERE classe = ${cell.classe} AND serie = ${cell.serie} AND matiere = ${cell.matiere}
    ORDER BY created_at DESC LIMIT 30`
  const model = modelPour(cell.classe)
  const message = await anthropic().messages.create(
    {
      model,
      ...generationParams(model, Math.min(20000, 4500 * combien)),
      system: generationPrompt(
        cell,
        deja.map((d) => d.titre),
        combien,
      ),
      messages: [
        { role: 'user', content: `Rédige les ${combien} sujets maintenant.` },
      ],
    },
    { timeout: 210_000, maxRetries: 1 },
  )
  const raw = message.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('')
  try {
    await db.sql`INSERT INTO ai_events (id, user_id, kind, mode, status, input_tokens, output_tokens)
      VALUES (${crypto.randomUUID()}, 'systeme', 'generation', ${model}, 'ok',
        ${message.usage?.input_tokens ?? 0}, ${message.usage?.output_tokens ?? 0})`
  } catch {
    // Le journal des coûts ne bloque pas la génération.
  }
  const parsed = parseModelJson(raw) as { sujets?: unknown }
  const list = Array.isArray(parsed?.sujets) ? parsed.sujets : [parsed]
  let ok = 0
  for (const item of list.slice(0, combien)) {
    const sujet = generatedSchema.safeParse(item)
    if (!sujet.success) continue
    await db.sql`INSERT INTO subjects (id, classe, serie, matiere, niveau, titre, chapitre, enonce, bareme, duree_min, corrige, run_id)
      VALUES (${crypto.randomUUID()}, ${cell.classe}, ${cell.serie}, ${cell.matiere}, ${cell.niveau},
        ${sujet.data.titre}, ${sujet.data.chapitre}, ${sujet.data.enonce}, ${sujet.data.bareme},
        ${dureePour(cell.classe, cell.niveau)}, ${sujet.data.corrige || null}, ${runId})`
    ok++
  }
  // Renouvellement : au-delà de l'objectif, les sujets les plus anciens sont archivés (jamais supprimés).
  await db.sql`UPDATE subjects SET archived_at = now() WHERE id IN (
      SELECT id FROM subjects
      WHERE classe = ${cell.classe} AND serie = ${cell.serie} AND matiere = ${cell.matiere}
        AND niveau = ${cell.niveau} AND archived_at IS NULL
      ORDER BY created_at DESC OFFSET ${cell.cible})`
  if (ok === 0) throw new Error('Lot illisible')
  return { ok, failed: combien - ok }
}

/** Classes à servir : celles qui ont des élèves (examens d'abord) ; sinon les classes d'examen. */
export async function activeClasses() {
  const db = getDatabase()
  const rows = await db.sql<{
    classe: string
    serie: string
  }>`SELECT DISTINCT classe, serie FROM profiles`
  const seen = new Map<string, { classe: string; serie: string }>()
  for (const r of rows) {
    if (!(CLASSES as readonly string[]).includes(r.classe)) continue
    const serie = normalizeSerie(r.classe, r.serie)
    if (
      cycleOf(r.classe) === 'lycee' &&
      !SERIES_PAR_CLASSE[r.classe]?.includes(serie)
    )
      continue
    seen.set(`${r.classe}|${serie}`, { classe: r.classe, serie })
  }
  const list = seen.size
    ? [...seen.values()]
    : CLASSES_EXAMEN.flatMap((classe) =>
        (SERIES_PAR_CLASSE[classe] ?? ['']).map((serie) => ({ classe, serie })),
      )
  const exam = (c: { classe: string }) =>
    (CLASSES_EXAMEN as readonly string[]).includes(c.classe)
  return list.sort((a, b) => Number(exam(b)) - Number(exam(a)))
}

export type Lot = { cell: Quota; combien: number }

/**
 * Lots à générer : pour chaque case, ce qui manque pour avoir l'objectif en sujets de moins de 7 jours.
 * Les cases les moins fournies passent d'abord (classes d'examen, puis le niveau 2 « examen »).
 */
export async function plan(scope: string, maxLots: number): Promise<Lot[]> {
  const [kind, rest = ''] = scope.split(/:(.*)/s)
  const [scopeClasse, scopeSerie = '', scopeMatiere] = rest.split('|')
  const classes =
    kind === 'classe' || kind === 'matiere'
      ? [{ classe: scopeClasse, serie: scopeSerie }]
      : await activeClasses()
  const quotas = classes
    .flatMap((c) => quotasPour(c.classe, c.serie))
    .filter((q) => kind !== 'matiere' || q.matiere === scopeMatiere)
  const db = getDatabase()
  const counts = await db.sql<{
    k: string
    n: number
  }>`SELECT classe || '|' || serie || '|' || matiere || '|' || niveau AS k, count(*)::int AS n
    FROM subjects
    WHERE archived_at IS NULL AND created_at > now() - make_interval(days => ${RENOUVELLEMENT_JOURS})
    GROUP BY 1`
  const fresh = new Map(counts.map((c) => [c.k, Number(c.n)]))
  const exam = (c: Quota) =>
    (CLASSES_EXAMEN as readonly string[]).includes(c.classe)
  return quotas
    .map((c) => {
      const n =
        fresh.get(`${c.classe}|${c.serie}|${c.matiere}|${c.niveau}`) ?? 0
      return { c, n, ratio: c.cible ? n / c.cible : 1 }
    })
    .filter((x) => x.n < x.c.cible)
    .sort(
      (a, b) =>
        a.ratio - b.ratio ||
        Number(exam(b.c)) - Number(exam(a.c)) ||
        Number(b.c.niveau === 2) - Number(a.c.niveau === 2),
    )
    .slice(0, maxLots)
    .map((x) => ({
      cell: x.c,
      combien: Math.min(SUJETS_PAR_APPEL, x.c.cible - x.n),
    }))
}

/** Plafond de sujets générés par jour (réglage admin) et nombre déjà créés aujourd'hui. */
export async function dailyBudget() {
  const db = getDatabase()
  const [row] = await db.sql<{ value: string | null; today: number }>`SELECT
      (SELECT value FROM app_settings WHERE key = 'actualisation_quota_jour') AS value,
      (SELECT count(*)::int FROM subjects WHERE created_at >= ${today()}::date) AS today`
  const parsed = Number(row?.value)
  const quota =
    row?.value != null && Number.isFinite(parsed)
      ? Math.max(0, Math.floor(parsed))
      : QUOTA_JOUR_DEFAUT
  return { quota, today: Number(row?.today ?? 0) }
}

/**
 * Exécute une actualisation déjà réservée (statut « running »).
 * S'arrête à la fin du budget de temps, au plafond du jour, ou dès que l'admin l'annule.
 */
export async function executeRun(
  runId: string,
  scope: string,
  budgetMs: number,
) {
  const db = getDatabase()
  const deadline = Date.now() + budgetMs
  const matiereScope = scope.startsWith('matiere:')
  const classScope = scope.startsWith('classe:') || matiereScope
  const lots = await plan(scope, matiereScope ? 4 : classScope ? 10 : 400)
  const budget = await dailyBudget()
  // La première visite d'une classe (40 sujets max) ou d'une matière (16 sujets max, un lot par
  // niveau) passe même si le plafond du jour est atteint.
  const allowed = matiereScope
    ? 16
    : classScope
      ? 40
      : Math.max(0, budget.quota - budget.today)
  let created = 0
  let failed = 0
  let cancelled = false
  let next = 0
  let reserved = 0
  const cancelledNow = async () => {
    const [row] = await db.sql<{
      status: string
    }>`SELECT status FROM refresh_runs WHERE id = ${runId}`
    return row?.status === 'cancelled'
  }
  const worker = async () => {
    // Un lot peut prendre 3 minutes : on n'en commence plus quand il reste moins de 4 minutes.
    while (
      !cancelled &&
      next < lots.length &&
      reserved < allowed &&
      Date.now() < deadline - 240_000
    ) {
      const lot = lots[next++]
      const combien = Math.min(lot.combien, allowed - reserved)
      reserved += combien
      try {
        const r = await generateBatch(lot.cell, combien, runId)
        created += r.ok
        failed += r.failed
      } catch {
        failed += combien
        if (failed >= 24 && created === 0) cancelled = true
      }
      if (await cancelledNow()) cancelled = true
      await db.sql`UPDATE refresh_runs SET created = ${created}, failed = ${failed} WHERE id = ${runId}`
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  await db.sql`UPDATE refresh_runs SET
      status = CASE WHEN status = 'cancelled' THEN 'cancelled' WHEN ${created} = 0 AND ${failed} > 0 THEN 'failed' ELSE 'done' END,
      created = ${created}, failed = ${failed}, finished_at = now(),
      error = CASE WHEN ${created} = 0 AND ${failed} > 0 THEN 'Aucun sujet n’a pu être généré' ELSE NULL END
    WHERE id = ${runId}`
  const wasCancelled = cancelled || (await cancelledNow())
  return {
    created,
    failed,
    cancelled: wasCancelled,
    // Encore du travail et du budget : la fonction d'arrière-plan peut enchaîner une nouvelle exécution.
    canContinue:
      !classScope &&
      !wasCancelled &&
      created > 0 &&
      next < lots.length &&
      reserved < allowed,
  }
}
