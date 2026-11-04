import { describe, expect, it } from 'vitest'
import {
  assembleLiveLesson,
  chapitreKey,
  cleanTest,
  livePartPrompt,
  nextReviewDays,
  scoreLessonTest,
  toLessonContent,
  verificationSchema,
} from './lecons'

describe('leçons du Professeur IA', () => {
  it('normalise le nom du chapitre pour éviter les doublons', () => {
    expect(chapitreKey('  Les Nombres complexes ! ')).toBe('les nombres complexes')
    expect(chapitreKey('Dérivée')).toBe(chapitreKey('derivee'))
  })

  it('refuse une leçon hors programme ou incomplète', () => {
    expect(toLessonContent({ hors_programme: true })).toBeNull()
    expect(toLessonContent({ titre: 'X', intuition: ['a', 'b'] })).toBeNull()
  })

  it('construit les 4 temps dans l’ordre', () => {
    const p = ['un', 'deux']
    const content = toLessonContent({
      titre: 'Les fractions',
      intuition: p,
      memo: p,
      exemple: p,
      pieges: p,
      reformulations: { intuition: 'a', memo: 'b', exemple: 'c', pieges: 'd' },
    })
    expect(content?.etapes.map((e) => e.key)).toEqual(['intuition', 'memo', 'exemple', 'pieges'])
  })

  it('programme les rappels à J+1, J+3 puis J+7', () => {
    expect([0, 1, 2, 3, 9].map(nextReviewDays)).toEqual([1, 3, 7, 7, 7])
  })
})

describe('rédaction express et test de fin de leçon', () => {
  const q = (bonne: number, etape = 'memo') => ({
    question: 'Combien font 2 + 2 ?',
    choix: ['3', '4', '5', '22'],
    bonne,
    explication: '2 + 2 = 4.',
    niveau: 'appliquer',
    etape,
  })
  const verif = { question: 'Vrai ou faux ?', choix: ['Vrai', 'Faux', 'Je ne sais pas'], bonne: 0, explication: 'Car c’est la définition.' }

  it('n’affiche rien tant que le 1er temps n’est pas prêt', () => {
    expect(assembleLiveLesson({})).toBeNull()
    expect(assembleLiveLesson({ memo: { memo: ['a', 'b'], reformulation: 'simple' } })).toBeNull()
  })

  it('livre les temps dans l’ordre, sans trou', () => {
    const ouverture = { titre: 'Les fractions', intuition: ['un', 'deux'], reformulation: 'simple', verification: verif }
    const sansMemo = assembleLiveLesson({
      ouverture,
      pieges: { pieges: ['p1', 'p2'], reformulation: 'r' },
    })
    expect(sansMemo?.etapes.map((e) => e.key)).toEqual(['intuition'])
    expect(sansMemo?.complet).toBe(false)
    const complete = assembleLiveLesson({
      ouverture,
      memo: { memo: ['m1', 'm2'], reformulation: 'r' },
      exemple: { exemple: ['e1', 'e2'], reformulation: 'r' },
      pieges: { pieges: ['p1', 'p2'], reformulation: 'r' },
      test: { questions: [q(1), q(0), q(2), q(3), q(1), q(0)] as never },
    })
    expect(complete?.etapes.map((e) => e.key)).toEqual(['intuition', 'memo', 'exemple', 'pieges'])
    expect(complete?.verifications?.intuition?.bonne).toBe(0)
    expect(complete?.complet).toBe(true)
  })

  it('écarte les questions de test invalides et exige au moins 4 questions', () => {
    expect(cleanTest([q(1), q(9), { question: 'x' }])).toBeUndefined()
    expect(cleanTest([q(1), q(2), q(0), q(3), q(9)])).toHaveLength(4)
    expect(cleanTest([q(1), { ...q(2), niveau: 'inconnu', etape: '?' }, q(0), q(3)])?.[1]).toMatchObject({
      niveau: 'comprendre',
      etape: 'memo',
    })
  })

  it('refuse une question de vérification dont la bonne réponse n’existe pas', () => {
    expect(verificationSchema.safeParse(verif).success).toBe(true)
    expect(verificationSchema.safeParse({ ...verif, bonne: 3 }).success).toBe(false)
  })

  it('note le test sur 10, une réponse absente compte faux', () => {
    const test = [q(1), q(0), q(2), q(3), q(1), q(0)]
    expect(scoreLessonTest(test, [1, 0, 2, 3, 1, 0])).toEqual({ bonnes: 6, total: 6, note: 10 })
    expect(scoreLessonTest(test, [1, 0, 2, -1])).toEqual({ bonnes: 3, total: 6, note: 5 })
    expect(scoreLessonTest(test, [1, 0, 2, 3, 0, 1]).note).toBe(6.5)
  })

  it('garde les objectifs, l’exercice guidé et le test rédigés par le Professeur IA', () => {
    const p = ['un', 'deux']
    const content = toLessonContent({
      titre: 'Les fractions',
      objectifs: ['Tu sauras comparer deux fractions', 'Tu sauras les additionner'],
      intuition: p,
      memo: p,
      exemple: p,
      pieges: p,
      pratique: { enonce: 'Calcule 1/2 + 1/4.', indices: ['Même dénominateur'], solution: ['3/4'] },
      reformulations: { intuition: 'a', memo: 'b', exemple: 'c', pieges: 'd' },
      test: [q(1), q(0), q(2), q(3)],
    })
    expect(content?.objectifs).toHaveLength(2)
    expect(content?.pratique?.solution).toEqual(['3/4'])
    expect(content?.test).toHaveLength(4)
  })

  it('les prompts de rédaction express suivent la méthode et réutilisent le mémo', () => {
    const ctx = { classe: '3e', serie: '', matiere: 'maths', chapitre: 'Théorème de Pythagore' }
    expect(livePartPrompt('ouverture', ctx)).toContain('hors_programme')
    expect(livePartPrompt('test', ctx, ['a² + b² = c²'])).toContain('a² + b² = c²')
    expect(livePartPrompt('exemple', ctx, ['x'])).toContain('indices progressifs')
  })
})
