import { expect, it } from 'vitest'
import { splitSentences, voicesFor } from './voice'

const v = (name: string, lang: string) => ({ name, lang, localService: true, voiceURI: name })

it('choisit d’abord une voix naturelle de la bonne langue, et ignore les autres langues', () => {
  const voices = [v('eSpeak English', 'en-GB'), v('Google UK English Female', 'en-GB'), v('Microsoft Aria Online (Natural)', 'en-US'), v('Thomas', 'fr-FR')]
  const ranked = voicesFor(voices, ['en-GB', 'en-US', 'en'])
  expect(ranked.map((x) => x.name)).toEqual(['Google UK English Female', 'Microsoft Aria Online (Natural)', 'eSpeak English'])
})

it('accepte toute variante régionale quand la principale manque', () => {
  expect(voicesFor([v('Luciana', 'pt_BR')], ['pt-PT', 'pt-BR', 'pt'])).toHaveLength(1)
  expect(voicesFor([v('Kyoko', 'ja-JP')], ['ko-KR', 'ko'])).toHaveLength(0)
})

it('découpe le texte en phrases, toutes écritures', () => {
  expect(splitSentences('Hello! How are you? Fine.')).toEqual(['Hello!', 'How are you?', 'Fine.'])
  expect(splitSentences('早上好。你叫什么名字？')).toEqual(['早上好。', '你叫什么名字？'])
  expect(splitSentences('ما اسمك؟ أنا بخير.')).toEqual(['ما اسمك؟', 'أنا بخير.'])
  expect(splitSentences('a '.repeat(200), 100).every((s) => s.length <= 100)).toBe(true)
})
