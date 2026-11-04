import { z } from 'zod'
import { normalizeSerie } from './curriculum'

export const AGE_RANGES = [
  'Moins de 13 ans',
  '13–15 ans',
  '16–17 ans',
  '18 ans et plus',
] as const
export const CLASSES = [
  'CP1',
  'CP2',
  'CE1',
  'CE2',
  'CM1',
  'CM2',
  '6e',
  '5e',
  '4e',
  '3e',
  'Seconde',
  'Première',
  'Terminale',
] as const
export const LANGUAGES = ['Anglais', 'Espagnol', 'Allemand'] as const
export const hasSerie = (classe: string) =>
  ['Seconde', 'Première', 'Terminale'].includes(classe)
export const profileSchema = z
  .object({
    firstName: z.string().trim().min(1, 'Indique ton prénom.').max(80),
    ageRange: z.enum(AGE_RANGES),
    pays: z.string().trim().min(2, 'Indique ton pays.').max(80),
    classe: z.enum(CLASSES),
    serie: z.string().trim().max(30),
    langues: z
      .array(z.enum(LANGUAGES))
      .min(1, 'Choisis au moins une langue.')
      .max(3)
      .transform((v) => [...new Set(v)]),
    niveauPrefere: z.coerce.number().int().min(1).max(4),
  })
  .superRefine((v, ctx) => {
    if (hasSerie(v.classe) && !v.serie)
      ctx.addIssue({
        code: 'custom',
        path: ['serie'],
        message: 'Indique ta série.',
      })
  })
  .transform((v) => ({ ...v, serie: normalizeSerie(v.classe, v.serie) }))

export function safeReturnTo(value: unknown) {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\s]/.test(value) ||
    [...value].some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    )
  )
    return '/accueil'
  const pathname = value.split(/[?#]/)[0]
  return /^\/(admin|accueil|explorer|lecons|quiz|ia|oral|profil|premium|examen\/[^/]+|sujets\/[^/]+)$/.test(
    pathname,
  )
    ? value
    : '/accueil'
}
