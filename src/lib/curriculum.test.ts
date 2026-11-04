import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ sql: vi.fn(), create: vi.fn() }))
vi.mock('@netlify/database', () => ({
  getDatabase: () => ({
    sql: (strings: TemplateStringsArray, ...values: unknown[]) =>
      h.sql(strings.join('?'), values),
  }),
}))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: h.create }
  },
}))
import {
  examenOf,
  matieresPour,
  normalizeSerie,
  toutesLesCellules,
} from './curriculum'
import { CLASSES } from './profile'
import { executeRun, generationPrompt, plan } from './generator.server'
import { listForClass } from './sujets.server'

beforeEach(() => {
  vi.clearAllMocks()
  h.sql.mockResolvedValue([])
})

it('donne à chaque classe ses propres matières', () => {
  expect(matieresPour('CP1', '').map((m) => m.id)).toEqual([
    'francais', 'maths', 'sciences', 'pc', 'hg', 'edhc', 'anglais', 'tice', 'arts', 'musique', 'eps',
  ])
  expect(matieresPour('6e', '').map((m) => m.id)).toContain('arts')
  expect(matieresPour('Terminale', 'E').map((m) => m.id)).toContain('technologie')
  expect(matieresPour('6e', '').map((m) => m.id)).not.toContain('espagnol')
  expect(matieresPour('3e', '').map((m) => m.id)).toContain('allemand')
  expect(matieresPour('Seconde', 'C').map((m) => m.id)).not.toContain('philo')
  expect(matieresPour('Terminale', 'A1').map((m) => m.id)).toContain('philo')
  expect(matieresPour('Terminale', 'D').map((m) => m.id)).toContain('svt')
  for (const [c, s] of [['CM2', ''], ['6e', ''], ['Seconde', 'A'], ['Terminale', 'A1'], ['Terminale', 'C']])
    expect(matieresPour(c, s).map((m) => m.id), `${c} ${s}`).toContain('pc')
  expect(examenOf('CM2')).toBe('CEPE')
  expect(examenOf('3e')).toBe('BEPC')
  expect(examenOf('Terminale')).toBe('BAC')
})

it('normalise la série saisie', () => {
  expect(normalizeSerie('Terminale', 'série d')).toBe('D')
  expect(normalizeSerie('CM2', 'D')).toBe('')
})

it('couvre toutes les classes, du CP1 à la Terminale', () => {
  const cells = toutesLesCellules(CLASSES)
  for (const classe of CLASSES) expect(cells.some((c) => c.classe === classe)).toBe(true)
  expect(cells.filter((c) => c.classe === 'Terminale' && c.serie === 'D')).toHaveLength(10 * 4)
})

it('rédige le sujet dans la langue étudiée et sans fausse année', () => {
  const p = generationPrompt({ classe: '4e', serie: '', matiere: 'espagnol', niveau: 2 }, ['Ancien titre'])
  expect(p).toContain('entièrement en espagnol')
  expect(p).toContain('BEPC')
  expect(p).toContain('Ancien titre')
  expect(p).toContain("Interdits : année d'examen")
})

it('remplit d’abord les cases vides d’une classe, niveau examen en tête', async () => {
  h.sql.mockResolvedValue([{ k: 'CM2||maths|2', n: 3 }])
  const lots = await plan('classe:CM2|', 60)
  expect(lots).toHaveLength(11 * 4)
  expect(lots[0].cell).toMatchObject({ classe: 'CM2', niveau: 2 })
  expect(lots[0].combien).toBe(4)
  expect(lots.at(-1)?.cell).toMatchObject({ matiere: 'maths', niveau: 2 })
})

it('enregistre les sujets générés pour la classe demandée', async () => {
  h.create.mockResolvedValue({
    content: [{ type: 'text', text: JSON.stringify({
      sujets: Array.from({ length: 4 }, () => ({
        titre: 'Le marché de Bouaké',
        chapitre: 'Les fractions',
        enonce: '1. Awa achète trois quarts d’un régime de bananes. Calcule…',
        bareme: '1) 10 pts · 2) 10 pts',
        corrige: '1) …',
      })),
    }) }],
    usage: { input_tokens: 10, output_tokens: 20 },
  })
  const res = await executeRun('run-1', 'classe:CM2|', 10 * 60_000)
  // Première visite d'une classe : 10 lots de 4 sujets, sans enchaîner d'autre exécution.
  expect(res).toEqual({ created: 40, failed: 0, cancelled: false, canContinue: false })
  const inserts = h.sql.mock.calls.filter(([q]) => q.includes('INSERT INTO subjects'))
  expect(inserts).toHaveLength(40)
  // Au-delà de l'objectif, les plus anciens sont archivés (jamais supprimés).
  expect(h.sql.mock.calls.some(([q]) => q.includes('SET archived_at = now()'))).toBe(true)
  expect(h.sql.mock.calls.some(([q]) => q.includes('DELETE'))).toBe(false)
  expect(inserts[0][1]).toEqual(expect.arrayContaining(['CM2', '', 'Le marché de Bouaké']))
})

it('ne liste que les sujets de la classe et de la série de l’élève', async () => {
  h.sql.mockImplementation(async (q: string) => (q.includes('count(*)') ? [{ total: 0 }] : []))
  const res = await listForClass({ classe: 'CM2', serie: '', limit: 10, offset: 0 })
  expect(res.sujets).toEqual([])
  const terminale = await listForClass({ classe: 'Terminale', serie: 'D', limit: 10, offset: 0 })
  expect(terminale.sujets.every((s) => s.classe === 'Terminale' && s.serie === 'D')).toBe(true)
  expect(terminale.sujets.length).toBeGreaterThan(0)
  const [, values] = h.sql.mock.calls[0]
  expect(values).toEqual(expect.arrayContaining(['CM2', '']))
})

describe('objectif de 1 000 sujets par classe', () => {
  it('répartit exactement 1 000 sujets entre les matières de chaque classe et série', async () => {
    const { quotasPour, SERIES_PAR_CLASSE } = await import('./curriculum')
    const { CLASSES } = await import('./profile')
    for (const classe of CLASSES)
      for (const serie of SERIES_PAR_CLASSE[classe] ?? ['']) {
        const total = quotasPour(classe, serie).reduce((n, q) => n + q.cible, 0)
        expect(total, `${classe} ${serie}`).toBe(1000)
      }
  })

  it('donne plus de sujets aux matières principales', async () => {
    const { quotasPour } = await import('./curriculum')
    const parMatiere = (m: string) =>
      quotasPour('Terminale', 'D')
        .filter((q) => q.matiere === m)
        .reduce((n, q) => n + q.cible, 0)
    expect(parMatiere('maths')).toBeGreaterThan(parMatiere('hg'))
    expect(Math.abs(parMatiere('svt') - parMatiere('pc'))).toBeLessThanOrEqual(1)
  })
})
