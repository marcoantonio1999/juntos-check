const cacheName = 'juntos-check-v3'
const appShell = ['./', './manifest.webmanifest', './favicon.svg']

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(cacheName).then((cache) => cache.addAll(appShell)).catch(() => undefined),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((key) => key !== cacheName).map((key) => caches.delete(key)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  if (url.origin !== self.location.origin) return
  if (url.hostname.endsWith('supabase.co')) return

  const isNavigation =
    request.mode === 'navigate' ||
    (request.destination === '' && request.headers.get('accept')?.includes('text/html'))

  if (isNavigation) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request, { cache: 'no-store' })
          const cache = await caches.open(cacheName)
          cache.put('./', fresh.clone()).catch(() => undefined)
          return fresh
        } catch {
          const cached = await caches.match('./')
          return cached || Response.error()
        }
      })(),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request)
        .then((response) => {
          if (!response.ok) return response
          const copy = response.clone()
          caches.open(cacheName).then((cache) => cache.put(request, copy)).catch(() => undefined)
          return response
        })
        .catch(() => caches.match('./').then((fallback) => fallback || Response.error()))
    }),
  )
})
