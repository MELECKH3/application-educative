import {
  generateExplanation,
  generateLesson,
  generateProgramme,
  generateQuiz,
} from '../../src/lib/contenu.server'

// Fonction d'arrière-plan (15 min max) : rédige un quiz du jour, une leçon, le programme d'une
// matière ou une explication « Explique-moi cette leçon » déjà réservés en base. Seuls les contenus « en attente » créés côté serveur sont traités.
export default async (req: Request) => {
  const body = (await req.json().catch(() => null)) as { kind?: unknown; id?: unknown } | null
  const id = typeof body?.id === 'string' ? body.id : ''
  if (!/^[0-9a-f-]{36}$/.test(id)) return
  if (body?.kind === 'quiz') await generateQuiz(id)
  else if (body?.kind === 'lecon') await generateLesson(id)
  else if (body?.kind === 'programme') await generateProgramme(id)
  else if (body?.kind === 'explication') await generateExplanation(id)
}
