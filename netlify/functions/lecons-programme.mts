import { prepareProgrammeLessons } from '../../src/lib/contenu.server'
import { switchOn } from '../../src/lib/admin.server'

// Chaque nuit à 01h30 (Abidjan = UTC) : le Professeur IA rédige à l'avance les leçons du programme
// officiel des classes qui ont des élèves, chapitre après chapitre, dans l'ordre de l'année.
export default async () => {
  const origin = process.env.URL
  if (!origin || (await switchOn('coupure_ia'))) return
  await prepareProgrammeLessons(origin)
}

export const config = { schedule: '30 1 * * *' }
