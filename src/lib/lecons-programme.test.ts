import { expect, it } from 'vitest'
import { cleanProgramme, programmePrompt } from './lecons'

it('nettoie la liste des chapitres du programme', () => {
  expect(
    cleanProgramme(['1. Les fractions', 'Chapitre 2 - Les décimaux', 'les fractions', 'II) Les angles']),
  ).toEqual(['Les fractions', 'Les décimaux', 'Les angles'])
})

it('demande le programme officiel de la classe et de la série', () => {
  const p = programmePrompt('Terminale', 'D', 'svt')
  expect(p).toContain('Terminale série D')
  expect(p).toContain('BAC')
  expect(p).toContain('programme officiel ivoirien')
})
