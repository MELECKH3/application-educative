import { z } from 'zod'
import type { Plan } from './access'
import { cycleOf, examenOf, matiereById } from './curriculum'
import type { LeconIA } from './lecons'

// « Explique-moi cette leçon » : le Professeur IA réexplique tout le chapitre, plus ou moins en
// profondeur selon la formule de l'élève. Chaque explication est rédigée une fois par leçon et par
// niveau, puis partagée par toute la classe (jamais régénérée par élève).

export const NIVEAUX_EXPLICATION = ['essentiel', 'detaille', 'approfondi'] as const
export type NiveauExplication = (typeof NIVEAUX_EXPLICATION)[number]

export const EXPLICATION_INFO: Record<
  NiveauExplication,
  { label: string; formule: string; contenu: string[] }
> = {
  essentiel: {
    label: 'Essentiel',
    formule: 'Gratuit',
    contenu: ['L’idée principale en mots simples', 'Un exemple guidé', 'Les points à retenir'],
  },
  detaille: {
    label: 'Détaillé',
    formule: 'Mensuel',
    contenu: [
      'Objectifs et prérequis du chapitre',
      'Explication pas à pas avec des images du quotidien',
      '2 exemples entièrement résolus',
      'Les erreurs fréquentes et comment les éviter',
      '3 exercices progressifs avec indices et corrigés',
      'Fiche mémo à recopier',
    ],
  },
  approfondi: {
    label: 'Approfondi',
    formule: 'Trimestriel',
    contenu: [
      'Tout le contenu Détaillé',
      'La méthode pour réussir ce chapitre à l’examen',
      'Un sujet type examen corrigé et commenté',
      'Liens avec les autres chapitres',
      '5 exercices dont 2 défis, avec corrigés',
    ],
  },
}

/** Niveaux ouverts selon la formule : l'essai et le Trimestriel ouvrent tout. */
export function niveauxPour(plan: Plan): NiveauExplication[] {
  if (plan === 'trimestriel') return ['essentiel', 'detaille', 'approfondi']
  if (plan === 'mensuel') return ['essentiel', 'detaille']
  return ['essentiel']
}

export const explicationRequestSchema = z.object({
  leconId: z.string().uuid(),
  niveau: z.enum(NIVEAUX_EXPLICATION),
})

const txt = (max: number) => z.string().trim().min(1).max(max)
const exerciceSchema = z.object({
  enonce: txt(1500),
  indice: z.string().trim().max(600).optional().default(''),
  corrige: txt(3000),
})
export const explicationSchema = z.object({
  titre: txt(200),
  accroche: txt(800),
  sections: z
    .array(z.object({ titre: txt(150), paragraphes: z.array(txt(1500)).min(1).max(8) }))
    .min(1)
    .max(10),
  exemples: z.array(exerciceSchema).max(3).optional().default([]),
  erreurs: z.array(txt(500)).max(8).optional().default([]),
  methode: z.array(txt(500)).max(8).optional().default([]),
  exercices: z.array(exerciceSchema).max(6).optional().default([]),
  memo: z.array(txt(400)).min(1).max(12),
})
export type Explication = z.infer<typeof explicationSchema>

const CONSIGNES: Record<NiveauExplication, string> = {
  essentiel: [
    'Niveau ESSENTIEL (formule gratuite) : court et clair.',
    '- "sections" : 2 ou 3 sections de 1 à 2 paragraphes courts qui expliquent l’idée principale.',
    '- "exemples" : 1 exemple simple résolu (énoncé + corrigé), "indice" vide.',
    '- "erreurs", "methode", "exercices" : listes vides.',
    '- "memo" : 3 à 5 points à retenir.',
  ].join('\n'),
  detaille: [
    'Niveau DÉTAILLÉ : une vraie séance de cours particulier, progressive et bienveillante.',
    '- "sections" (5 à 7) dans cet ordre : « Ce que tu vas apprendre » (objectifs), « Ce qu’il faut déjà savoir » (prérequis rappelés),',
    '  puis l’explication pas à pas du chapitre en plusieurs sections (une notion par section, avec une image concrète de la vie en Côte d’Ivoire),',
    '  et « Pourquoi c’est utile ».',
    '- "exemples" : 2 exemples entièrement résolus, chaque étape justifiée (« Étape 1 — … »).',
    '- "erreurs" : 3 à 5 erreurs fréquentes, chacune avec la bonne méthode.',
    '- "methode" : liste vide.',
    '- "exercices" : 3 exercices progressifs (facile, moyen, type examen), chacun avec un indice et un corrigé détaillé.',
    '- "memo" : la fiche mémo complète (définitions, formules ou règles), une idée par ligne.',
  ].join('\n'),
  approfondi: [
    'Niveau APPROFONDI : tout le niveau détaillé, pour viser l’excellence à l’examen.',
    '- "sections" (6 à 9) : objectifs, prérequis, explication pas à pas (une notion par section, images concrètes de la vie en Côte d’Ivoire),',
    '  « Aller plus loin » (cas particuliers, démonstration ou raisonnement de fond adapté à la classe) et « Liens avec les autres chapitres ».',
    '- "exemples" : 2 exemples résolus et justifiés, dont un sujet type examen complet avec son barème commenté.',
    '- "erreurs" : 4 à 6 erreurs fréquentes avec la bonne méthode.',
    '- "methode" : 4 à 6 conseils de méthode pour l’examen (lecture du sujet, rédaction attendue, gestion du temps, points du barème).',
    '- "exercices" : 5 exercices progressifs dont les 2 derniers sont des défis, chacun avec un indice et un corrigé détaillé.',
    '- "memo" : la fiche mémo complète, une idée par ligne.',
  ].join('\n'),
}

export function explicationPrompt(lecon: LeconIA, niveau: NiveauExplication) {
  const matiere = matiereById(lecon.matiere)
  const label = `${lecon.classe}${lecon.serie ? ` série ${lecon.serie}` : ''}`
  const primaire = cycleOf(lecon.classe) === 'primaire'
  const base = lecon.etapes
    .map((e) => `## ${e.titre}\n${e.contenu.join('\n')}`)
    .join('\n\n')
  return [
    `Tu es le Professeur IA d'Annales+, le meilleur professeur de ${matiere?.nom ?? lecon.matiere} de Côte d'Ivoire. Un élève de ${label} te dit : « Explique-moi cette leçon ». Tu lui réexpliques le chapitre « ${lecon.chapitre} » de façon pédagogique, détaillée et éducative, conforme au programme officiel ivoirien et utile pour le ${examenOf(lecon.classe)}.`,
    `Voici la leçon déjà donnée à l'élève (à approfondir, sans la recopier) :\n<lecon_donnees>\n${base}\n</lecon_donnees>`,
    CONSIGNES[niveau],
    primaire
      ? 'Élève de primaire : phrases très courtes, mots simples, nombres adaptés à son âge.'
      : 'Niveau de langue adapté à la classe, rigoureux, sans jargon inutile.',
    matiere?.langue
      ? 'Leçon de langue : explications en français, exemples et vocabulaire dans la langue étudiée.'
      : '',
    `Exactitude absolue : vérifie chaque formule, chaque calcul et chaque fait. Interdits : sources, auteurs ou citations inventés, années d'examen.`,
    `Texte simple sans Markdown ni LaTeX (écris x², √, ≤, f′(x)). Tutoie l'élève, encourage-le.`,
    `Réponds uniquement avec un objet JSON valide : {"titre": "...", "accroche": "une phrase qui donne envie", "sections": [{"titre": "...", "paragraphes": ["..."]}], "exemples": [{"enonce": "...", "indice": "", "corrige": "..."}], "erreurs": ["..."], "methode": ["..."], "exercices": [{"enonce": "...", "indice": "...", "corrige": "..."}], "memo": ["..."]}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** Longueur maximale de la réponse du Professeur IA selon le niveau. */
export const maxTokensFor = (niveau: NiveauExplication) =>
  niveau === 'essentiel' ? 2000 : niveau === 'detaille' ? 7000 : 10000

/** Modèle de rédaction : Sonnet pour l'essentiel et le détaillé, le plus performant pour l'approfondi. */
export const modelFor = (niveau: NiveauExplication, models: { sonnet: string; opus: string }) =>
  niveau === 'approfondi' ? models.opus : models.sonnet
