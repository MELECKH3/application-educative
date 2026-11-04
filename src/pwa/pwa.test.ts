import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { isNewVersion } from './pwa'

describe('mises à jour de l’application', () => {
  it('signale une nouvelle version seulement si elle diffère', () => {
    expect(isNewVersion('abc', 'abc')).toBe(false)
    expect(isNewVersion('abc', 'def')).toBe(true)
    expect(isNewVersion('abc', undefined)).toBe(false)
    expect(isNewVersion('abc', '')).toBe(false)
  })

  it('ne met jamais en cache les fonctions serveur ni les API', () => {
    const sw = readFileSync('src/pwa/sw.template.js', 'utf8')
    expect(sw).toContain("'/_serverFn'")
    expect(sw).toContain("'/api/'")
    expect(sw).toContain('__APP_VERSION__')
  })

  it('décrit une application installable', () => {
    const manifest = JSON.parse(
      readFileSync('public/manifest.webmanifest', 'utf8'),
    )
    expect(manifest.display).toBe('standalone')
    expect(manifest.icons.some((i: { sizes: string }) => i.sizes === '512x512')).toBe(true)
  })
})
