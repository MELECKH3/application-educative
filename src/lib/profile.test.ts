import { describe, expect, it } from 'vitest'
import { profileSchema, safeReturnTo } from './profile'

const profile = {
  firstName: '  Fatou  ',
  ageRange: '16–17 ans',
  pays: 'Sénégal',
  classe: 'Terminale',
  serie: 'S',
  langues: ['Anglais'],
  niveauPrefere: 2,
}

describe('profil élève', () => {
  it('ne permet pas de soumettre un profil incomplet ou une préférence invalide', () => {
    for (const data of [
      { ...profile, firstName: ' ' },
      { ...profile, ageRange: '' },
      { ...profile, pays: '' },
      { ...profile, classe: '' },
      { ...profile, serie: '' },
      { ...profile, langues: [] },
      { ...profile, niveauPrefere: 5 },
    ]) {
      expect(profileSchema.safeParse(data).success).toBe(false)
    }
  })
  it('exclut les identifiants et rôles fournis par le navigateur', () => {
    const parsed = profileSchema.parse({
      ...profile,
      userId: 'autre-eleve',
      role: 'admin',
    })
    expect(parsed.firstName).toBe('Fatou')
    expect(parsed).not.toHaveProperty('userId')
    expect(parsed).not.toHaveProperty('role')
  })
  it('ne conserve pas une ancienne série pour une classe primaire', () => {
    expect(profileSchema.parse({ ...profile, classe: 'CM2' }).serie).toBe('')
  })
})

describe('retour après connexion', () => {
  it('conserve la page demandée et ses filtres', () => {
    expect(safeReturnTo('/explorer?matiere=maths')).toBe(
      '/explorer?matiere=maths',
    )
    expect(safeReturnTo('/examen/sujet-1')).toBe('/examen/sujet-1')
  })
  it('bloque les redirections externes et les boucles de connexion', () => {
    for (const target of [
      'https://example.com',
      '//example.com',
      '/\\example.com',
      '/connexion',
      '/bienvenue',
      '/\nexample.com',
      '/%2fexample.com',
      undefined,
    ])
      expect(safeReturnTo(target)).toBe('/accueil')
  })
})
