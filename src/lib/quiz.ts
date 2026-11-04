import { z } from 'zod'
import { cycleOf, examenOf, matieresPour, matieresPrincipales } from './curriculum'

// Quiz du jour : partagé par le serveur et l'interface (aucune réponse n'est envoyée avant la fin).
export const QUIZ_QUESTIONS = 10
export const QUIZ_SECONDS_PER_QUESTION = 20

/** Jour du quiz : minuit à Abidjan = minuit UTC. */
export const quizDay = (now = new Date()) => now.toISOString().slice(0, 10)

export const quizQuestionSchema = z.object({
  matiere: z.string().trim().min(2).max(40),
  question: z.string().trim().min(5).max(500),
  choix: z.array(z.string().trim().min(1).max(200)).length(4),
  bonne: z.number().int().min(0).max(3),
  explication: z.string().trim().min(5).max(600),
})
export type QuizQuestion = z.infer<typeof quizQuestionSchema>

export const quizGeneratedSchema = z.object({
  questions: z.array(quizQuestionSchema).min(QUIZ_QUESTIONS),
})

export const quizSubmitSchema = z.object({
  quizId: z.string().uuid(),
  // -1 = temps écoulé sans réponse.
  answers: z.array(z.number().int().min(-1).max(3)).length(QUIZ_QUESTIONS),
})

export function quizPrompt(classe: string, serie: string, day: string) {
  const matieres = matieresPour(classe, serie)
  const principales = matieresPrincipales(classe, serie)
  const label = `${classe}${serie ? ` série ${serie}` : ''}`
  return [
    `Tu prépares le « Quiz du jour » d'Annales+ (${day}) pour les élèves de ${label} en Côte d'Ivoire, qui préparent le ${examenOf(classe)}. Programme officiel ivoirien de cette classe uniquement.`,
    `Écris exactement ${QUIZ_QUESTIONS} questions à choix multiple (4 choix, une seule bonne réponse indiscutable). Mélange les matières de la classe : ${matieres.map((m) => `${m.nom} (id « ${m.id} »)`).join(', ')}. Au moins une question par matière principale (${principales.join(', ')}), et pas plus de 3 questions dans la même matière.`,
    `Progression : 4 questions faciles, 4 moyennes, 2 difficiles. Chaque question se résout en moins de 20 secondes (pas de longs calculs). Varie les chapitres.`,
    cycleOf(classe) === 'primaire'
      ? 'Élève de primaire : phrases très courtes, vocabulaire simple.'
      : 'Utilise si possible des situations de la vie en Côte d’Ivoire (prénoms, villes, FCFA).',
    `Questions de langue (anglais, espagnol, allemand) : rédigées dans la langue étudiée. Les autres en français.`,
    `Les mauvais choix sont plausibles (erreurs fréquentes des élèves). Pas de « toutes les réponses », pas de piège sur la formulation. L'explication (2 phrases maximum, en français) dit pourquoi la bonne réponse est juste.`,
    `Interdits : années ou sessions d'examen, sources inventées, citations attribuées à des personnes réelles. Texte simple sans Markdown ni LaTeX (écris x², √, ≤).`,
    `Réponds uniquement avec un objet JSON valide : {"questions": [{"matiere": "id", "question": "...", "choix": ["...", "...", "...", "..."], "bonne": 0, "explication": "..."}]}`,
  ].join('\n\n')
}

/** Mélange les choix (le modèle place souvent la bonne réponse en premier). */
export function shuffleChoices(q: QuizQuestion, random = Math.random): QuizQuestion {
  const order = [0, 1, 2, 3]
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return { ...q, choix: order.map((i) => q.choix[i]), bonne: order.indexOf(q.bonne) }
}

/** Garde 10 questions valides : matières de la classe, choix distincts. */
export function cleanQuiz(questions: QuizQuestion[], allowed: string[], random = Math.random) {
  return questions
    .filter(
      (q) =>
        allowed.includes(q.matiere) &&
        new Set(q.choix.map((c) => c.toLowerCase())).size === 4,
    )
    .slice(0, QUIZ_QUESTIONS)
    .map((q) => shuffleChoices(q, random))
}

export function scoreQuiz(questions: QuizQuestion[], answers: number[]) {
  return questions.reduce((n, q, i) => n + (answers[i] === q.bonne ? 1 : 0), 0)
}

/** Série de jours consécutifs avec un quiz terminé, qui se termine aujourd'hui ou hier. */
export function quizStreak(days: string[], today: string) {
  const set = new Set(days)
  const dayMs = 86_400_000
  let cursor = Date.parse(`${today}T00:00:00Z`)
  if (!set.has(today)) cursor -= dayMs
  let n = 0
  while (set.has(new Date(cursor).toISOString().slice(0, 10))) {
    n++
    cursor -= dayMs
  }
  return n
}
