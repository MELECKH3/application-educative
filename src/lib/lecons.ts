import { z } from 'zod'
import { cycleOf, examenOf, matiereById } from './curriculum'

// Leçons du Professeur IA : rédigées une fois par chapitre, partagées par toute la classe.

export type LessonStepKey = 'intuition' | 'memo' | 'exemple' | 'pieges'
export type LessonStep = { key: LessonStepKey; titre: string; contenu: string[] }
export type LeconIA = {
  id: string
  classe: string
  serie: string
  matiere: string
  chapitre: string
  titre: string
  etapes: LessonStep[]
  reformulations: Record<LessonStepKey, string>
} & LessonExtras

export const STEP_KEYS: LessonStepKey[] = ['intuition', 'memo', 'exemple', 'pieges']
export const STEP_TITLES: Record<LessonStepKey, string> = {
  intuition: 'Comprendre',
  memo: 'L’essentiel à retenir',
  exemple: 'Exemple résolu',
  pieges: 'Pièges fréquents',
}

/** Nouveaux chapitres qu'un élève peut faire rédiger par jour (les leçons existantes sont illimitées). */
export const LESSONS_PER_STUDENT_PER_DAY = 5
export const LESSONS_PER_DAY_TOTAL = 80

/** « Les Nombres complexes ! » → « les nombres complexes », pour éviter les doublons. */
export function chapitreKey(chapitre: string) {
  return chapitre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .slice(0, 120)
}

export const lessonRequestSchema = z.object({
  matiere: z.string().min(2).max(40),
  chapitre: z.string().trim().min(3, 'Écris le nom du chapitre.').max(120),
})

const paragraphs = z.array(z.string().trim().min(2).max(900)).min(2).max(12)

// ── Méthode pédagogique ─────────────────────────────────────────────────────────
// Objectifs explicites, activation des acquis, du concret vers l'abstrait, charge cognitive maîtrisée,
// exemple résolu puis exercice guidé (indices progressifs), questions de récupération après chaque temps,
// conceptions erronées traitées, et test final couvrant retenir / comprendre / appliquer / analyser.

const choixSchema = z.array(z.string().trim().min(1).max(240)).min(3).max(4)
export const verificationSchema = z
  .object({
    question: z.string().trim().min(5).max(400),
    choix: choixSchema,
    bonne: z.number().int().min(0).max(3),
    explication: z.string().trim().min(5).max(600),
  })
  .refine((v) => v.bonne < v.choix.length, 'Bonne réponse hors des choix')
export type Verification = z.infer<typeof verificationSchema>

export const NIVEAUX_QUESTION = ['retenir', 'comprendre', 'appliquer', 'analyser'] as const
export type NiveauQuestion = (typeof NIVEAUX_QUESTION)[number]
export const NIVEAU_QUESTION_LABEL: Record<NiveauQuestion, string> = {
  retenir: 'Retenir',
  comprendre: 'Comprendre',
  appliquer: 'Appliquer',
  analyser: 'Analyser',
}

export const testQuestionSchema = z
  .object({
    question: z.string().trim().min(5).max(500),
    choix: z.array(z.string().trim().min(1).max(240)).length(4),
    bonne: z.number().int().min(0).max(3),
    explication: z.string().trim().min(5).max(700),
    niveau: z.enum(NIVEAUX_QUESTION).catch('comprendre'),
    etape: z.enum(['intuition', 'memo', 'exemple', 'pieges']).catch('memo'),
  })
export type TestQuestion = z.infer<typeof testQuestionSchema>

/** Test de fin de leçon : 6 questions (5 à 8 acceptées). */
export const TEST_QUESTIONS = 6
export const lessonTestSchema = z.object({
  questions: z.array(z.unknown()).transform((items) =>
    items
      .map((q) => testQuestionSchema.safeParse(q))
      .filter((r) => r.success)
      .map((r) => r.data as TestQuestion)
      .slice(0, 8),
  ),
})

export const pratiqueSchema = z.object({
  enonce: z.string().trim().min(5).max(900),
  indices: z.array(z.string().trim().min(2).max(500)).min(1).max(3),
  solution: z.array(z.string().trim().min(2).max(900)).min(1).max(10),
})
export type Pratique = z.infer<typeof pratiqueSchema>

/** Formule, règle ou définition clé, avec son sens en mots simples et un mini-exemple. */
export const formuleSchema = z.object({
  nom: z.string().trim().min(2).max(120),
  formule: z.string().trim().min(1).max(300),
  sens: z.string().trim().min(3).max(400),
  exemple: z.string().trim().max(400).catch('').default(''),
})
export type Formule = z.infer<typeof formuleSchema>

/** Exemple résolu supplémentaire (du plus simple au type examen). */
export const exempleSchema = z.object({
  titre: z.string().trim().min(2).max(120),
  enonce: z.string().trim().min(5).max(900),
  solution: z.array(z.string().trim().min(2).max(900)).min(1).max(10),
})
export type ExempleResolu = z.infer<typeof exempleSchema>

/** Mot difficile du chapitre expliqué simplement. */
export const motCleSchema = z.object({
  mot: z.string().trim().min(1).max(80),
  sens: z.string().trim().min(3).max(300),
})
export type MotCle = z.infer<typeof motCleSchema>

/** Garde les éléments valides d'une liste (les autres sont ignorés), ou undefined si rien de valide. */
function lenientList<T extends z.ZodTypeAny>(schema: T, max: number) {
  return z
    .array(z.unknown())
    .transform((items) => {
      const ok = items
        .map((x) => schema.safeParse(x))
        .filter((r) => r.success)
        .map((r) => r.data as z.infer<T>)
        .slice(0, max)
      return ok.length ? ok : undefined
    })
    .optional()
    .catch(undefined)
}
const formulesList = lenientList(formuleSchema, 8)
const exemplesList = lenientList(exempleSchema, 3)
const motsClesList = lenientList(motCleSchema, 6)
const retenirList = lenientList(z.string().trim().min(3).max(300), 8)

export type LessonExtras = {
  objectifs?: string[]
  amorce?: string
  motsCles?: MotCle[]
  formules?: Formule[]
  exemples?: ExempleResolu[]
  retenir?: string[]
  verifications?: Partial<Record<LessonStepKey, Verification>>
  pratique?: Pratique
  test?: TestQuestion[]
}

const objectifsSchema = z.array(z.string().trim().min(3).max(240)).min(2).max(5)
const amorceSchema = z.string().trim().min(5).max(500)
const reformulationSchema = z.string().trim().min(5).max(900)
const opt = <T extends z.ZodTypeAny>(schema: T) => schema.optional().catch(undefined)

export const lessonWrittenSchema = z.object({
  hors_programme: z.boolean().optional(),
  titre: z.string().trim().min(3).max(160).optional(),
  intuition: paragraphs.optional(),
  memo: paragraphs.optional(),
  exemple: paragraphs.optional(),
  pieges: paragraphs.optional(),
  reformulations: z
    .object({
      intuition: z.string().trim().max(900),
      memo: z.string().trim().max(900),
      exemple: z.string().trim().max(900),
      pieges: z.string().trim().max(900),
    })
    .optional(),
  objectifs: opt(objectifsSchema),
  amorce: opt(amorceSchema),
  verifications: opt(
    z.object({
      intuition: opt(verificationSchema),
      memo: opt(verificationSchema),
      exemple: opt(verificationSchema),
      pieges: opt(verificationSchema),
    }),
  ),
  pratique: opt(pratiqueSchema),
  motsCles: motsClesList,
  formules: formulesList,
  exemples: exemplesList,
  retenir: retenirList,
  test: opt(z.array(z.unknown())),
})

const PEDAGOGIE = [
  `Méthode pédagogique (sciences de l'apprentissage) :`,
  `- objectifs explicites : ce que l'élève saura FAIRE à la fin (verbes d'action : calculer, expliquer, reconnaître, rédiger…) ;`,
  `- activer les acquis et la curiosité avant d'enseigner (question d'amorce liée à la vie réelle) ;`,
  `- du concret vers l'abstrait, une seule idée par phrase, des étapes courtes (charge cognitive maîtrisée) ;`,
  `- exemple entièrement résolu, puis exercice semblable que l'élève fait seul avec des indices progressifs ;`,
  `- après chaque partie, une question de vérification (récupération active) avec une explication de la bonne réponse ;`,
  `- traiter les conceptions erronées réelles des élèves ivoiriens, pas des erreurs artificielles ;`,
  `- les mauvais choix d'un QCM sont des erreurs plausibles d'élève, jamais absurdes ; une seule bonne réponse indiscutable.`,
].join('\n')

/** Leçons claires : comprises du premier coup, lues sur téléphone. */
const CLARTE = [
  `Clarté avant tout : explique comme un grand frère patient qui veut que TOUT le monde comprenne, même l'élève le plus faible de la classe.`,
  `- phrases courtes (20 mots maximum), mots simples ; chaque mot difficile est expliqué la première fois qu'il apparaît ;`,
  `- jamais une règle sans un exemple juste après (« Par exemple : … ») ; montre le « pourquoi », pas seulement le « comment » ;`,
  `- calculs détaillés pas à pas, sans sauter d'étape : on écrit chaque étape et on dit ce qu'on fait ;`,
  `- aucune répétition inutile, aucune formule de politesse. Chaque explication de QCM tient en 1 ou 2 phrases.`,
].join('\n')

// Consignes de chaque partie, communes à la rédaction complète et à la rédaction express.
const MOTS_CLES = `2 à 5 mots difficiles ou nouveaux du chapitre, chacun expliqué en une phrase simple`
const INTUITION = `fais comprendre l'idée avant les formules, avec des images concrètes de la vie en Côte d'Ivoire (marché, gbaka, cacao, FCFA, famille…). 3 ou 4 paragraphes courts, dont au moins 2 petits exemples de la vie courante.`
const MEMO = `l'essentiel à retenir, comme la trace écrite du cahier — définitions, propriétés, règles, dates ou notions clés. Une idée par ligne (5 à 8 lignes), précise et exacte ; chaque ligne importante est suivie de « Ex. : … » avec un mini-exemple.`
const FORMULES = `2 à 6 formules, règles, définitions ou dates clés à connaître par cœur (en langue : structures de phrase ; en histoire : dates et notions). Pour chacune : « nom », « formule » (la formule ou la règle exacte), « sens » (ce qu'elle veut dire en mots simples, et quand l'utiliser), « exemple » (application chiffrée ou concrète en une ligne).`
const EXEMPLE = (examen: string) =>
  `un exercice type ${examen} entièrement résolu. Première ligne « Énoncé : … », puis 3 à 5 étapes « Étape 1 — … » qui expliquent ce qu'on fait et pourquoi, et une conclusion d'une phrase.`
const EXEMPLES = (examen: string) =>
  `2 autres exemples résolus, différents du premier : un « Exemple facile » (pour démarrer en confiance) et un « Exemple type ${examen} » (plus exigeant). Pour chacun : « titre », « enonce » et « solution » (étapes détaillées, une par ligne).`
const PIEGES = `3 ou 4 erreurs fréquentes des élèves, chacune sur une ligne avec la bonne méthode (« Piège : … → Bonne méthode : … »).`
const RETENIR = `4 à 6 points à retenir pour l'examen : phrases très courtes, faciles à réciter, qui résument TOUT le chapitre (règles, formules, méthode).`
const MOT_JSON = `{"mot": "...", "sens": "..."}`
const FORMULE_JSON = `{"nom": "...", "formule": "...", "sens": "...", "exemple": "..."}`
const EXEMPLE_JSON = `{"titre": "...", "enonce": "...", "solution": ["..."]}`

function contexte(classe: string, serie: string, matiereId: string, chapitre: string) {
  const matiere = matiereById(matiereId)
  const label = `${classe}${serie ? ` série ${serie}` : ''}`
  const primaire = cycleOf(classe) === 'primaire'
  return [
    `Tu es le meilleur professeur de ${matiere?.nom ?? matiereId} de Côte d'Ivoire. Tu rédiges pour Annales+ la leçon « ${chapitre} » destinée aux élèves de ${label}, conforme au programme officiel ivoirien de cette classe (approche par compétences) et utile pour le ${examenOf(classe)}.`,
    PEDAGOGIE,
    primaire
      ? 'Élève de primaire : phrases très courtes, mots simples, nombres adaptés à son âge.'
      : 'Niveau de langue adapté à la classe, rigoureux, sans jargon inutile.',
    matiere?.langue
      ? `Leçon de langue : explications en français, exemples et vocabulaire dans la langue étudiée.`
      : '',
    `Exactitude absolue : vérifie chaque formule, chaque calcul et chaque fait. Interdits : sources, auteurs ou citations inventés, années d'examen.`,
    `Texte simple sans Markdown ni LaTeX (écris x², √, ≤, f′(x)). Tutoie l'élève.`,
    CLARTE,
  ]
    .filter(Boolean)
    .join('\n\n')
}

const VERIF_JSON = `{"question": "...", "choix": ["...", "...", "..."], "bonne": 0, "explication": "..."}`
const TEST_JSON = `{"question": "...", "choix": ["...", "...", "...", "..."], "bonne": 0, "explication": "...", "niveau": "retenir|comprendre|appliquer|analyser", "etape": "intuition|memo|exemple|pieges"}`
const testConsigne = (examen: string) =>
  `Test de fin de leçon : exactement ${TEST_QUESTIONS} QCM à 4 choix, du plus simple au plus exigeant : 1 « retenir », 2 « comprendre », 2 « appliquer » (petit calcul ou cas concret type ${examen}), 1 « analyser ». Varie la position de la bonne réponse. « etape » = la partie de la leçon à revoir si l'élève se trompe. L'explication (1 ou 2 phrases) dit pourquoi la bonne réponse est juste ET pourquoi l'erreur tentante est fausse.`

export function lessonWriterPrompt(classe: string, serie: string, matiereId: string, chapitre: string) {
  const matiere = matiereById(matiereId)
  const label = `${classe}${serie ? ` série ${serie}` : ''}`
  return [
    contexte(classe, serie, matiereId, chapitre),
    `Si ce chapitre n'existe pas dans le programme de ${matiere?.nom ?? matiereId} en ${label}, ou si la demande n'est pas un chapitre scolaire, réponds seulement {"hors_programme": true}.`,
    `Sinon : « objectifs » (2 à 4), « amorce » (une question qui relie le chapitre à la vie de l'élève), « motsCles » (${MOTS_CLES}), puis la leçon en 4 temps :`,
    `1. « intuition » : ${INTUITION}`,
    `2. « memo » : ${MEMO} « formules » : ${FORMULES}`,
    `3. « exemple » : ${EXEMPLE(examenOf(classe))} « exemples » : ${EXEMPLES(examenOf(classe))} Puis « pratique » : un exercice semblable que l'élève fait seul, 1 ou 2 indices progressifs et la solution en quelques lignes.`,
    `4. « pieges » : ${PIEGES} « retenir » : ${RETENIR}`,
    `Ajoute « reformulations » : pour chaque temps, une réexplication plus simple en 1 ou 2 phrases ; et « verifications » : pour chaque temps, un QCM de 3 choix.`,
    testConsigne(examenOf(classe)),
    `Réponds uniquement avec un objet JSON valide : {"titre": "...", "objectifs": ["..."], "amorce": "...", "motsCles": [${MOT_JSON}], "intuition": ["..."], "memo": ["..."], "formules": [${FORMULE_JSON}], "exemple": ["..."], "exemples": [${EXEMPLE_JSON}], "pratique": {"enonce": "...", "indices": ["..."], "solution": ["..."]}, "pieges": ["..."], "retenir": ["..."], "reformulations": {"intuition": "...", "memo": "...", "exemple": "...", "pieges": "..."}, "verifications": {"intuition": ${VERIF_JSON}, "memo": ..., "exemple": ..., "pieges": ...}, "test": [${TEST_JSON}]}`,
  ].join('\n\n')
}

/** Garde les questions de test valides (au moins 4), sinon aucune. */
export function cleanTest(items: unknown): TestQuestion[] | undefined {
  if (!Array.isArray(items)) return undefined
  const valid = items
    .map((q) => testQuestionSchema.safeParse(q))
    .filter((r) => r.success)
    .map((r) => r.data as TestQuestion)
    .slice(0, 8)
  return valid.length >= 4 ? valid : undefined
}

/** Transforme la réponse validée en contenu stocké, ou null si la leçon est hors programme/incomplète. */
export function toLessonContent(raw: z.infer<typeof lessonWrittenSchema>) {
  if (raw.hors_programme || !raw.titre || !raw.reformulations) return null
  const etapes: LessonStep[] = []
  for (const key of STEP_KEYS) {
    const contenu = raw[key]
    if (!contenu) return null
    etapes.push({ key, titre: STEP_TITLES[key], contenu })
  }
  const extras: LessonExtras = {
    objectifs: raw.objectifs,
    amorce: raw.amorce,
    verifications: raw.verifications,
    pratique: raw.pratique,
    motsCles: raw.motsCles,
    formules: raw.formules,
    exemples: raw.exemples,
    retenir: raw.retenir,
    test: cleanTest(raw.test),
  }
  return { titre: raw.titre, etapes, reformulations: raw.reformulations, ...extras }
}

// ── Rédaction express (en direct, en parallèle) ──────────────────────────────────
// La leçon est découpée en 5 parties rédigées en même temps par un modèle rapide :
// « ouverture » et « memo » d'abord (en parallèle), puis exemple, pièges et test à partir du mémo
// (cohérence des formules). Le 1er temps s'affiche en quelques secondes, la suite arrive pendant la lecture.

export const LIVE_PARTS = ['ouverture', 'memo', 'exemple', 'exemples', 'pieges', 'test'] as const
export type LivePart = (typeof LIVE_PARTS)[number]

export const livePartSchemas = {
  ouverture: z.object({
    hors_programme: z.boolean().optional(),
    titre: z.string().trim().min(3).max(160).optional(),
    objectifs: objectifsSchema.optional(),
    amorce: amorceSchema.optional(),
    intuition: paragraphs.optional(),
    motsCles: motsClesList,
    reformulation: reformulationSchema.optional(),
    verification: opt(verificationSchema),
  }),
  memo: z.object({
    memo: paragraphs,
    formules: formulesList,
    reformulation: reformulationSchema,
    verification: opt(verificationSchema),
  }),
  exemple: z.object({
    exemple: paragraphs,
    pratique: opt(pratiqueSchema),
    reformulation: reformulationSchema,
    verification: opt(verificationSchema),
  }),
  exemples: z.object({ exemples: exemplesList }),
  pieges: z.object({
    pieges: paragraphs,
    retenir: retenirList,
    reformulation: reformulationSchema,
    verification: opt(verificationSchema),
  }),
  test: lessonTestSchema,
}
export type LiveParts = { [K in LivePart]?: z.infer<(typeof livePartSchemas)[K]> }

export const LIVE_MAX_TOKENS: Record<LivePart, number> = {
  ouverture: 1600,
  memo: 1800,
  exemple: 2000,
  exemples: 2200,
  pieges: 1300,
  test: 2000,
}

export function livePartPrompt(
  part: LivePart,
  ctx: { classe: string; serie: string; matiere: string; chapitre: string },
  memo?: string[],
) {
  const { classe, serie, matiere: matiereId, chapitre } = ctx
  const matiere = matiereById(matiereId)
  const label = `${classe}${serie ? ` série ${serie}` : ''}`
  const ref = memo?.length
    ? `L'essentiel de la leçon, déjà rédigé (garde exactement les mêmes notations, définitions et formules) :\n<memo>\n${memo.join('\n')}\n</memo>`
    : ''
  const verif = `« verification » : un QCM de 3 choix sur cette partie (${VERIF_JSON}).`
  const consignes: Record<LivePart, string> = {
    ouverture: [
      `Si ce chapitre n'existe pas dans le programme de ${matiere?.nom ?? matiereId} en ${label}, ou si la demande n'est pas un chapitre scolaire, réponds seulement {"hors_programme": true}.`,
      `Sinon, rédige l'OUVERTURE et le TEMPS 1 de la leçon : « titre » (titre du chapitre tel que dans le cahier), « objectifs » (2 à 4, « Tu sauras… »), « amorce » (une question qui relie le chapitre à la vie de l'élève), « motsCles » (${MOTS_CLES}), « intuition » : ${INTUITION} « reformulation » : réexplication plus simple en 1 ou 2 phrases. ${verif}`,
      `JSON : {"titre": "...", "objectifs": ["..."], "amorce": "...", "motsCles": [${MOT_JSON}], "intuition": ["..."], "reformulation": "...", "verification": {...}}`,
    ].join('\n\n'),
    memo: [
      `Rédige uniquement le TEMPS 2 « L'essentiel à retenir ». « memo » : ${MEMO} « formules » : ${FORMULES} « reformulation » : version plus simple en 1 ou 2 phrases. ${verif}`,
      `JSON : {"memo": ["..."], "formules": [${FORMULE_JSON}], "reformulation": "...", "verification": {...}}`,
    ].join('\n\n'),
    exemple: [
      ref,
      `Rédige uniquement le TEMPS 3 « Exemple résolu » : ${EXEMPLE(examenOf(classe))} Puis « pratique » : un exercice semblable que l'élève fait seul, 1 ou 2 indices progressifs (du plus léger au plus précis) et la solution en quelques lignes. « reformulation » : la méthode en 1 ou 2 phrases. ${verif}`,
      `JSON : {"exemple": ["..."], "pratique": {"enonce": "...", "indices": ["..."], "solution": ["..."]}, "reformulation": "...", "verification": {...}}`,
    ].join('\n\n'),
    exemples: [
      ref,
      `Rédige uniquement des EXEMPLES SUPPLÉMENTAIRES pour le chapitre « ${chapitre} ». « exemples » : ${EXEMPLES(examenOf(classe))} Utilise exactement les notations et formules de l'essentiel ci-dessus.`,
      `JSON : {"exemples": [${EXEMPLE_JSON}]}`,
    ].join('\n\n'),
    pieges: [
      ref,
      `Rédige uniquement le TEMPS 4 « Pièges fréquents ». « pieges » : ${PIEGES} « retenir » : ${RETENIR} « reformulation » : le conseil le plus important en 1 ou 2 phrases. ${verif}`,
      `JSON : {"pieges": ["..."], "retenir": ["..."], "reformulation": "...", "verification": {...}}`,
    ].join('\n\n'),
    test: [
      ref,
      `Rédige uniquement le TEST DE FIN DE LEÇON sur ce chapitre (« ${chapitre} »), en t'appuyant sur l'essentiel ci-dessus. Ne pose aucune question à l'élève hors du JSON.`,
      testConsigne(examenOf(classe)),
      `JSON : {"questions": [${TEST_JSON}]}`,
    ].join('\n\n'),
  }
  return [
    contexte(classe, serie, matiereId, chapitre),
    consignes[part],
    `Réponds uniquement avec un objet JSON valide, sans texte autour.`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** Test de fin de leçon pour une leçon déjà rédigée qui n'en a pas encore. */
export function lessonTestPrompt(lecon: Pick<LeconIA, 'classe' | 'serie' | 'matiere' | 'chapitre' | 'etapes'>) {
  return [
    contexte(lecon.classe, lecon.serie, lecon.matiere, lecon.chapitre),
    `La leçon est déjà rédigée :\n<lecon_donnees>\n${lecon.etapes.map((e) => `[${e.key}] ${e.titre} :\n${e.contenu.join('\n')}`).join('\n\n')}\n</lecon_donnees>`,
    testConsigne(examenOf(lecon.classe)),
    `Réponds uniquement avec un objet JSON valide, sans texte autour : {"questions": [${TEST_JSON}]}`,
  ].join('\n\n')
}

type StoredLesson = NonNullable<ReturnType<typeof toLessonContent>>

/**
 * Leçon (même partielle) à partir des parties reçues : les temps sont livrés dans l'ordre,
 * sans trou (le temps 3 n'apparaît qu'après le 2). null tant que le 1er temps n'est pas prêt.
 */
export function assembleLiveLesson(parts: LiveParts): (StoredLesson & { complet: boolean }) | null {
  const o = parts.ouverture
  if (!o?.titre || !o.intuition || !o.reformulation) return null
  const steps: Record<LessonStepKey, { contenu?: string[]; reformulation?: string; verification?: Verification }> = {
    intuition: { contenu: o.intuition, reformulation: o.reformulation, verification: o.verification },
    memo: { contenu: parts.memo?.memo, reformulation: parts.memo?.reformulation, verification: parts.memo?.verification },
    exemple: {
      contenu: parts.exemple?.exemple,
      reformulation: parts.exemple?.reformulation,
      verification: parts.exemple?.verification,
    },
    pieges: {
      contenu: parts.pieges?.pieges,
      reformulation: parts.pieges?.reformulation,
      verification: parts.pieges?.verification,
    },
  }
  const etapes: LessonStep[] = []
  const reformulations = { intuition: '', memo: '', exemple: '', pieges: '' } as Record<LessonStepKey, string>
  const verifications: Partial<Record<LessonStepKey, Verification>> = {}
  for (const key of STEP_KEYS) {
    const s = steps[key]
    if (!s.contenu) break
    etapes.push({ key, titre: STEP_TITLES[key], contenu: s.contenu })
    reformulations[key] = s.reformulation ?? ''
    if (s.verification) verifications[key] = s.verification
  }
  const test = parts.test ? cleanTest(parts.test.questions) : undefined
  return {
    titre: o.titre,
    etapes,
    reformulations,
    objectifs: o.objectifs,
    amorce: o.amorce,
    motsCles: o.motsCles,
    formules: etapes.some((e) => e.key === 'memo') ? parts.memo?.formules : undefined,
    exemples: etapes.some((e) => e.key === 'exemple') ? parts.exemples?.exemples : undefined,
    retenir: etapes.some((e) => e.key === 'pieges') ? parts.pieges?.retenir : undefined,
    verifications,
    pratique: etapes.some((e) => e.key === 'exemple') ? parts.exemple?.pratique : undefined,
    test,
    complet: etapes.length === STEP_KEYS.length && !!test,
  }
}

/** Note du test sur 10 (arrondie au demi-point) ; une réponse absente compte faux. */
export function scoreLessonTest(test: Pick<TestQuestion, 'bonne'>[], answers: number[]) {
  const bonnes = test.reduce((n, q, i) => n + (answers[i] === q.bonne ? 1 : 0), 0)
  const total = test.length
  const note = total ? Math.round((bonnes / total) * 20) / 2 : 0
  return { bonnes, total, note }
}

export const lessonTestSubmitSchema = z.object({
  leconId: z.string().uuid(),
  answers: z.array(z.number().int().min(-1).max(3)).min(1).max(8),
})

/** Répétition espacée : J+1, puis J+3, puis J+7 (et J+7 ensuite). */
export const REVIEW_DAYS = [1, 3, 7] as const
export const nextReviewDays = (step: number) => REVIEW_DAYS[Math.min(step, REVIEW_DAYS.length - 1)]

// ── Programme officiel par classe ────────────────────────────────────────────────
/** Leçons rédigées automatiquement chaque nuit selon le programme (budget séparé des demandes d'élèves). */
export const AUTO_LESSONS_PER_NIGHT = 40
export const PROGRAMME_REQUESTER = 'programme'

export const programmeSchema = z.object({
  chapitres: z.array(z.string().trim().min(3).max(120)).min(4).max(30),
})

export function programmePrompt(classe: string, serie: string, matiereId: string) {
  const matiere = matiereById(matiereId)
  const label = `${classe}${serie ? ` série ${serie}` : ''}`
  return [
    `Tu es inspecteur pédagogique de ${matiere?.nom ?? matiereId} en Côte d'Ivoire.`,
    `Donne la liste des chapitres (leçons) du programme officiel ivoirien de ${matiere?.nom ?? matiereId} en classe de ${label}, dans l'ordre où ils sont enseignés pendant l'année scolaire, en vue du ${examenOf(classe)}.`,
    `Entre 8 et 24 chapitres. Chaque titre est court (comme dans le cahier de l'élève), sans numéro, sans trimestre ni commentaire.`,
    `Uniquement des chapitres réellement au programme de cette classe : rien des classes supérieures.`,
    `Réponds uniquement avec un objet JSON valide : {"chapitres": ["...", "..."]}`,
  ].join('\n\n')
}

/** Supprime les doublons et numérotations éventuelles (« 1. Les fractions » → « Les fractions »). */
export function cleanProgramme(chapitres: string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const c of chapitres) {
    const titre = c.replace(/^\s*(?:chapitre\s*)?[\dIVX]+\s*[.):–-]\s*/i, '').trim()
    const k = chapitreKey(titre)
    if (k.length < 3 || seen.has(k)) continue
    seen.add(k)
    out.push(titre)
  }
  return out
}
