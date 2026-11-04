// Modèles servis par Netlify AI Gateway (aucune clé à gérer). Imports autorisés partout,
// y compris dans les Netlify Functions.

/** Tuteur et oral : rapide, beaucoup de messages. */
export const TUTOR_MODEL = 'claude-haiku-5-5'
/** Professeur IA en direct (réexplications, correction du résumé) : précis et pédagogue. */
export const LESSON_MODEL = 'claude-sonnet-5-5'
/** Rédaction des leçons : le plus performant, une seule fois par chapitre puis partagé. */
export const LESSON_WRITER_MODEL = 'claude-opus-5-5'
/** Quiz du jour : une génération par classe et par jour, réponses vérifiées. */
export const QUIZ_MODEL = 'claude-sonnet-5-5'
/** Rédaction express d'une leçon en direct (parties en parallèle) et tests de fin de leçon : le plus rapide. */
export const LESSON_FAST_MODEL = 'claude-haiku-5-5'

/** Jetons réservés à la réflexion interne des modèles qui ne permettent pas de la couper. */
export const THINKING_MARGIN = 8000

/**
 * Paramètres de longueur et de réflexion d'un appel. Sans eux, le modèle peut « réfléchir »
 * jusqu'à épuiser `max_tokens` et ne renvoyer aucun texte (leçons, quiz ou reçus illisibles).
 * Haiku : réflexion coupée. Sonnet et Opus (réflexion obligatoire) : effort réduit et marge en plus
 * de la longueur de réponse voulue.
 */
export function generationParams(model: string, maxTokens: number) {
  if (model.includes('haiku')) return { max_tokens: maxTokens, thinking: { type: 'disabled' as const } }
  return {
    max_tokens: maxTokens + THINKING_MARGIN,
    thinking: { type: 'adaptive' as const },
    output_config: { effort: 'low' as const },
  }
}
