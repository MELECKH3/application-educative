import { describe, expect, it } from 'vitest'
import { cleanQuiz, quizDay, quizStreak, scoreQuiz, shuffleChoices, type QuizQuestion } from './quiz'

const q = (matiere: string, choix = ['a', 'b', 'c', 'd']): QuizQuestion => ({
  matiere,
  question: 'Combien font 2 + 2 ?',
  choix,
  bonne: 0,
  explication: 'Parce que 2 + 2 = 4.',
})

describe('quiz du jour', () => {
  it('utilise le jour UTC (Abidjan)', () => {
    expect(quizDay(new Date('2026-11-04T23:59:00Z'))).toBe('2026-11-04')
    expect(quizDay(new Date('2026-11-05T00:00:00Z'))).toBe('2026-11-05')
  })

  it('mélange les choix sans perdre la bonne réponse', () => {
    const shuffled = shuffleChoices(q('maths', ['juste', 'x', 'y', 'z']), () => 0)
    expect(shuffled.choix[shuffled.bonne]).toBe('juste')
    expect([...shuffled.choix].sort()).toEqual(['juste', 'x', 'y', 'z'])
  })

  it('écarte les matières hors classe et les choix en double', () => {
    const list = [q('maths'), q('philo'), q('maths', ['a', 'A', 'b', 'c'])]
    expect(cleanQuiz(list, ['maths'])).toHaveLength(1)
  })

  it('calcule le score côté serveur', () => {
    const qs = [q('maths'), q('maths'), q('maths')]
    expect(scoreQuiz(qs, [0, 1, -1])).toBe(1)
  })

  it('compte la série de jours consécutifs', () => {
    expect(quizStreak(['2026-11-04', '2026-11-03', '2026-11-01'], '2026-11-04')).toBe(2)
    // Pas encore joué aujourd'hui : la série d'hier reste valable.
    expect(quizStreak(['2026-11-03', '2026-11-02'], '2026-11-04')).toBe(2)
    expect(quizStreak(['2026-11-01'], '2026-11-04')).toBe(0)
  })
})
