import { describe, expect, it } from 'vitest'
import { LESSON_FAST_MODEL, LESSON_WRITER_MODEL, QUIZ_MODEL, THINKING_MARGIN, generationParams } from './models'

describe('generationParams', () => {
  it('coupe la réflexion du modèle rapide (rédaction express)', () => {
    expect(generationParams(LESSON_FAST_MODEL, 1000)).toEqual({ max_tokens: 1000, thinking: { type: 'disabled' } })
  })

  it('laisse une marge de réflexion à Sonnet et Opus pour que la réponse ne soit jamais coupée', () => {
    for (const model of [QUIZ_MODEL, LESSON_WRITER_MODEL]) {
      const p = generationParams(model, 6000)
      expect(p.max_tokens).toBe(6000 + THINKING_MARGIN)
      expect(p).toMatchObject({ thinking: { type: 'adaptive' }, output_config: { effort: 'low' } })
    }
  })
})
