import { RECEIPT_NAMES_LABEL } from './config'
// Sentinelle des paiements : règles pures (testées) appliquées à chaque déclaration.
// Les signaux s'appuient uniquement sur des faits de la base, jamais sur des suppositions.

export type Gravite = 'haute' | 'moyenne' | 'basse'
export type Motif = { gravite: Gravite; texte: string }
export type Verdict = { gravite: Gravite | null; score: number; motifs: Motif[] }

/** « ab-12.34 » → « AB1234 » : deux références qui ne diffèrent que par la ponctuation sont identiques. */
export const normalizeReference = (ref: string) =>
  ref.toUpperCase().replace(/[^A-Z0-9]/g, '')

/** Référence manifestement inventée : un seul caractère répété ou une suite (123456, ABCDEF). */
export function referenceFactice(ref: string) {
  const r = normalizeReference(ref)
  if (r.length < 6) return true
  if (/^(.)\1+$/.test(r)) return true
  const codes = [...r].map((c) => c.charCodeAt(0))
  const step = codes[1] - codes[0]
  return (
    Math.abs(step) === 1 && codes.every((c, i) => i === 0 || c - codes[i - 1] === step)
  )
}

export type PaymentFacts = {
  reference: string
  amount: number
  expectedAmount: number | null
  /** Autres paiements dont la référence normalisée est identique (statuts). */
  sameReference: string[]
  /** Déclarations du même élève sur 24 h (y compris celle-ci). */
  declarations24h: number
  /** Refus du même élève sur 30 jours. */
  refus30j: number
  /** Autres paiements du même élève encore en attente. */
  autresEnAttente: number
  /** Âge du compte élève au moment de la déclaration (minutes). */
  ageCompteMinutes: number
  /** Jours de Premium encore actifs au moment de la déclaration. */
  joursPremiumRestants: number
  /**
   * Nom du bénéficiaire lu sur le reçu (ADOU MELCHI, ADOU MELECK ou ADOU MELECKH) :
   * true = conforme, false = autre nom, null/absent = reçu non lu (paiement sans capture ou analyse indisponible).
   */
  beneficiaireOk?: boolean | null
}

const POIDS: Record<Gravite, number> = { haute: 50, moyenne: 20, basse: 8 }

export function analysePayment(f: PaymentFacts): Verdict {
  const motifs: Motif[] = []
  if (f.expectedAmount != null && f.amount !== f.expectedAmount)
    motifs.push({
      gravite: 'haute',
      texte: `Montant ${f.amount} FCFA différent de l’offre (${f.expectedAmount} FCFA).`,
    })
  if (f.sameReference.includes('accepted'))
    motifs.push({
      gravite: 'haute',
      texte: 'Même ID de transaction qu’un paiement déjà accepté (rejeu).',
    })
  else if (f.sameReference.length)
    motifs.push({
      gravite: 'haute',
      texte: 'ID de transaction déjà déclaré sous une autre écriture.',
    })
  if (f.beneficiaireOk === false)
    motifs.push({
      gravite: 'haute',
      texte: `Le reçu ne porte pas le nom ${RECEIPT_NAMES_LABEL}.`,
    })
  else if (f.beneficiaireOk === null)
    motifs.push({
      gravite: 'moyenne',
      texte: `Nom du bénéficiaire non lu : vérifie qu’il s’agit de ${RECEIPT_NAMES_LABEL}.`,
    })
  if (referenceFactice(f.reference))
    motifs.push({ gravite: 'haute', texte: 'ID de transaction qui semble inventé.' })
  if (f.refus30j >= 2)
    motifs.push({
      gravite: f.refus30j >= 3 ? 'haute' : 'moyenne',
      texte: `${f.refus30j} paiements refusés en 30 jours pour cet élève.`,
    })
  if (f.declarations24h >= 3)
    motifs.push({
      gravite: 'moyenne',
      texte: `${f.declarations24h} déclarations en 24 h.`,
    })
  if (f.autresEnAttente > 0)
    motifs.push({
      gravite: 'moyenne',
      texte: `${f.autresEnAttente} autre(s) paiement(s) du même élève en attente.`,
    })
  if (f.ageCompteMinutes < 60)
    motifs.push({ gravite: 'basse', texte: 'Compte créé il y a moins d’une heure.' })
  if (f.joursPremiumRestants > 20)
    motifs.push({
      gravite: 'basse',
      texte: `Premium encore actif ${f.joursPremiumRestants} jours.`,
    })
  const score = Math.min(100, motifs.reduce((s, m) => s + POIDS[m.gravite], 0))
  const gravite = motifs.some((m) => m.gravite === 'haute')
    ? 'haute'
    : motifs.some((m) => m.gravite === 'moyenne')
      ? 'moyenne'
      : motifs.length
        ? 'basse'
        : null
  return { gravite, score, motifs }
}

/** Refus immédiat à la déclaration : rejeu d'une référence déjà utilisée ou référence inventée. */
export function refusImmediat(f: Pick<PaymentFacts, 'reference' | 'sameReference'>) {
  if (f.sameReference.length)
    return 'Cet ID de transaction a déjà été déclaré. Vérifie le reçu de ton paiement.'
  if (referenceFactice(f.reference))
    return 'Cet ID de transaction ne semble pas valide. Recopie-le exactement depuis le SMS ou le reçu Wave / Orange Money.'
  return null
}
