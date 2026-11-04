/* global self, caches, fetch, URL, Response */
/* Annales+ — service worker. Version injectée à chaque publication : un nouveau fichier = une mise à jour. */
const VERSION = '__APP_VERSION__'
const STATIC_CACHE = `annales-static-${VERSION}`
const RUNTIME_CACHE = `annales-runtime-${VERSION}`
const OFFLINE_URL = '/hors-ligne.html'
const PRECACHE = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('annales-') && !k.endsWith(VERSION))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

// Jamais mis en cache : données de l'élève, paiements, examens, IA, authentification.
const NEVER_CACHE = ['/_serverFn', '/api/', '/.netlify/', '/_server']

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com']

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  const sameOrigin = url.origin === self.location.origin

  if (req.mode === 'navigate') {
    // Pages : toujours la version en ligne (donc toujours à jour) ; page de secours sans réseau.
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(OFFLINE_URL).then((r) => r || Response.error()),
      ),
    )
    return
  }

  if (sameOrigin) {
    if (NEVER_CACHE.some((p) => url.pathname.startsWith(p))) return
    if (url.pathname === '/sw.js' || url.pathname === '/version.json') return
    // Fichiers versionnés (nom unique par publication) : cache d'abord.
    if (url.pathname.startsWith('/assets/')) {
      event.respondWith(cacheFirst(req))
      return
    }
    if (/\.(png|jpe?g|webp|avif|svg|ico|webmanifest)$/.test(url.pathname)) {
      event.respondWith(staleWhileRevalidate(req))
    }
    return
  }

  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(req))
  }
})

async function cacheFirst(req) {
  const cached = await caches.match(req)
  if (cached) return cached
  const res = await fetch(req)
  if (res.ok) {
    const cache = await caches.open(RUNTIME_CACHE)
    cache.put(req, res.clone())
  }
  return res
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME_CACHE)
  const cached = await cache.match(req)
  const network = fetch(req)
    .then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone())
      return res
    })
    .catch(() => cached)
  return cached || network
}
