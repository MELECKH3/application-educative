import { expect, it } from 'vitest'
import { niveauxPour, explicationSchema } from './explication'

it('ouvre la profondeur de l’explication selon la formule', () => {
  expect(niveauxPour('gratuit')).toEqual(['essentiel'])
  expect(niveauxPour('mensuel')).toEqual(['essentiel', 'detaille'])
  expect(niveauxPour('trimestriel')).toEqual(['essentiel', 'detaille', 'approfondi'])
})

it('accepte une explication essentielle sans exercices', () => {
  const x = explicationSchema.parse({
    titre: 'Les fractions',
    accroche: 'Partager un attiéké équitablement.',
    sections: [{ titre: 'L’idée', paragraphes: ['Une fraction est une part.'] }],
    memo: ['a/b : a parts sur b'],
  })
  expect(x.exercices).toEqual([])
})
