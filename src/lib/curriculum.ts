// Programme par classe : matières, séries et examen visé. Utilisé par l'interface,
// le serveur et le générateur de sujets (imports relatifs uniquement).

export type Matiere = { id: string; nom: string; emoji: string; langue?: 'en' | 'es' | 'de' }

const M = {
  francais: { id: 'francais', nom: 'Français', emoji: '📖' },
  maths: { id: 'maths', nom: 'Mathématiques', emoji: '📐' },
  sciences: { id: 'sciences', nom: 'Sciences et technologie', emoji: '🔬' },
  hg: { id: 'hg', nom: 'Histoire-Géo', emoji: '🗺️' },
  edhc: { id: 'edhc', nom: 'EDHC', emoji: '🤝' },
  anglais: { id: 'anglais', nom: 'Anglais', emoji: '🇬🇧', langue: 'en' },
  pc: { id: 'pc', nom: 'Physique-Chimie', emoji: '⚗️' },
  svt: { id: 'svt', nom: 'SVT', emoji: '🌿' },
  espagnol: { id: 'espagnol', nom: 'Espagnol', emoji: '🇪🇸', langue: 'es' },
  allemand: { id: 'allemand', nom: 'Allemand', emoji: '🇩🇪', langue: 'de' },
  philo: { id: 'philo', nom: 'Philosophie', emoji: '💭' },
  tice: { id: 'tice', nom: 'Informatique (TICE)', emoji: '💻' },
  arts: { id: 'arts', nom: 'Arts plastiques', emoji: '🎨' },
  musique: { id: 'musique', nom: 'Éducation musicale', emoji: '🎵' },
  eps: { id: 'eps', nom: 'EPS', emoji: '🏃' },
  technologie: { id: 'technologie', nom: 'Sciences et techniques industrielles', emoji: '⚙️' },
} satisfies Record<string, Matiere>

export const ALL_MATIERES: Matiere[] = Object.values(M)
export const matiereById = (id: string) => ALL_MATIERES.find((m) => m.id === id)

const PRIMAIRE = ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2']
const COLLEGE = ['6e', '5e', '4e', '3e']
const LYCEE = ['Seconde', 'Première', 'Terminale']

export const SERIES_PAR_CLASSE: Record<string, string[]> = {
  Seconde: ['A', 'C'],
  Première: ['A1', 'A2', 'C', 'D', 'E'],
  Terminale: ['A1', 'A2', 'C', 'D', 'E'],
}

/** « série d », « Série D », « d » → « D ». Les séries inconnues restent lisibles. */
export function normalizeSerie(classe: string, serie: string) {
  if (!LYCEE.includes(classe)) return ''
  const s = serie
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/SERIE|\s|-/g, '')
    .slice(0, 4)
  return s
}

export function cycleOf(classe: string) {
  if (PRIMAIRE.includes(classe)) return 'primaire' as const
  if (COLLEGE.includes(classe)) return 'college' as const
  return 'lycee' as const
}

export function examenOf(classe: string) {
  if (PRIMAIRE.includes(classe)) return 'CEPE'
  if (COLLEGE.includes(classe)) return 'BEPC'
  return 'BAC'
}

/** Matières étudiées dans une classe (et une série au lycée), selon le programme ivoirien. */
export function matieresPour(classe: string, serie: string): Matiere[] {
  const cycle = cycleOf(classe)
  if (cycle === 'primaire')
    return [M.francais, M.maths, M.sciences, M.pc, M.hg, M.edhc, M.anglais, M.tice, M.arts, M.musique, M.eps]
  if (cycle === 'college') {
    const lv2 = ['4e', '3e'].includes(classe) ? [M.espagnol, M.allemand] : []
    return [M.francais, M.maths, M.anglais, ...lv2, M.pc, M.svt, M.hg, M.edhc, M.tice, M.arts, M.musique, M.eps]
  }
  const philo = classe === 'Seconde' ? [] : [M.philo]
  const communes = [M.edhc, M.tice, M.eps]
  const s = normalizeSerie(classe, serie)
  if (s.startsWith('A'))
    return [M.francais, ...philo, M.anglais, M.espagnol, M.allemand, M.hg, M.maths, M.pc, M.svt, ...communes]
  if (s === 'C' || s === 'D')
    return [M.maths, M.pc, M.svt, M.francais, ...philo, M.anglais, M.hg, ...communes]
  return [M.maths, M.pc, M.technologie, M.francais, ...philo, M.anglais, M.hg, ...communes]
}

/** Durée réaliste d'une épreuve selon la classe et le niveau (minutes). */
export function dureePour(classe: string, niveau: number) {
  const cycle = cycleOf(classe)
  const base = cycle === 'primaire' ? [30, 45, 60, 60] : cycle === 'college' ? [45, 60, 90, 120] : [60, 120, 180, 240]
  return base[Math.min(3, Math.max(0, niveau - 1))]
}

export type Cellule = { classe: string; serie: string; matiere: string; niveau: number }

/** Toutes les combinaisons classe × série × matière × niveau couvertes par la Grande Actualisation. */
export function toutesLesCellules(classes: readonly string[]): Cellule[] {
  const out: Cellule[] = []
  for (const classe of classes) {
    const series = SERIES_PAR_CLASSE[classe]?.filter((s) => s !== 'E') ?? ['']
    for (const serie of series)
      for (const m of matieresPour(classe, serie))
        for (const niveau of [1, 2, 3, 4]) out.push({ classe, serie, matiere: m.id, niveau })
  }
  return out
}

// ── Objectif de la Grande Actualisation ─────────────────────────────────────────────
// 1 000 sujets par classe (et par série au lycée), partagés entre ses matières, renouvelés
// en continu : chaque sujet reste en ligne 7 jours, puis il est remplacé par un nouveau.
export const SUJETS_PAR_CLASSE = 1000
export const RENOUVELLEMENT_JOURS = 7

/** Classes d'examen (CEPE, BEPC, BAC), servies en premier. */
export const CLASSES_EXAMEN = ['CM2', '3e', 'Terminale'] as const

/** Matières principales de l'examen : elles reçoivent deux fois plus de sujets. */
export function matieresPrincipales(classe: string, serie: string): string[] {
  const cycle = cycleOf(classe)
  if (cycle === 'primaire') return ['francais', 'maths']
  if (cycle === 'college') return ['francais', 'maths', 'pc']
  const s = normalizeSerie(classe, serie)
  if (s.startsWith('A')) return ['francais', 'philo']
  if (s === 'D') return ['maths', 'pc', 'svt']
  if (s === 'C' || s === 'E') return ['maths', 'pc']
  return ['francais', 'maths']
}

/** Répartit `total` selon des poids, en entiers dont la somme vaut exactement `total`. */
function repartir(total: number, poids: number[]) {
  const somme = poids.reduce((a, b) => a + b, 0)
  const exact = poids.map((p) => (total * p) / somme)
  const parts = exact.map(Math.floor)
  let reste = total - parts.reduce((a, b) => a + b, 0)
  const ordre = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r || a.i - b.i)
  for (const { i } of ordre) {
    if (reste <= 0) break
    parts[i]++
    reste--
  }
  return parts
}

export type Quota = Cellule & { cible: number }

/**
 * Nombre de sujets visés pour chaque matière × niveau d'une classe : 1 000 au total,
 * matières principales ×2, puis 25 % par niveau.
 */
export function quotasPour(classe: string, serie: string, total = SUJETS_PAR_CLASSE): Quota[] {
  const s = normalizeSerie(classe, serie)
  const matieres = matieresPour(classe, s)
  const principales = matieresPrincipales(classe, s)
  const parMatiere = repartir(
    total,
    matieres.map((m) => (principales.includes(m.id) ? 2 : 1)),
  )
  return matieres.flatMap((m, i) =>
    repartir(parMatiere[i], [1, 1, 1, 1]).map((cible, n) => ({
      classe,
      serie: s,
      matiere: m.id,
      niveau: n + 1,
      cible,
    })),
  )
}
