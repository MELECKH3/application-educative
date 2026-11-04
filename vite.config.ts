import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import netlify from '@netlify/vite-plugin-tanstack-start'

/** Identifiant unique de la publication : sert à prévenir les élèves qu'une mise à jour est disponible. */
const APP_VERSION = (
  process.env.COMMIT_REF?.slice(0, 12) || 'local'
) + '-' + Date.now().toString(36)

/** Génère /sw.js (service worker versionné) et /version.json dans le dossier publié. */
function pwa(): Plugin {
  return {
    name: 'annales-pwa',
    applyToEnvironment: (env) => env.name === 'client',
    generateBundle() {
      const sw = readFileSync(
        new URL('./src/pwa/sw.template.js', import.meta.url),
        'utf8',
      ).replaceAll('__APP_VERSION__', APP_VERSION)
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: sw })
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: APP_VERSION }),
      })
    },
  }
}

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  plugins: [tailwindcss(), netlify(), tanstackStart(), viteReact(), pwa()],
})

export default config
