// Offline-first for the app shell. The build lists every file it made in ASSETS and names the cache after
// them (see vite.config.ts), so the whole app is stored on first visit and an update replaces the old copy.
// Built files are named by their content, so a cached one never goes stale and is served from the cache.
// Pages and the manifest go to the network first, so an update shows up on the next launch, and fall back to
// the cache when offline. Notes live in the browser's own storage, not here.
const CACHE = 'euclidnote-dev'
const ASSETS = []
// Paths are relative to where the app is served from, which is wherever this file is.
const SHELL = ['./', 'manifest.webmanifest', 'favicon.svg', 'favicon-32.png', 'icon-192.png', 'icon-512.png', 'icon-180.png']
const at = (path) => new URL(path, self.registration.scope).href

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([...SHELL, ...ASSETS].map(at))).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return

  // Hashed build output: cache first.
  if (url.href.startsWith(at('assets/'))) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()))
            return res
          }),
      ),
    )
    return
  }

  // Everything else (the page, the manifest, icons): network first, then whatever we have.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(req.mode === 'navigate' ? at('./') : req, res.clone()))
        return res
      })
      .catch(() => caches.match(req.mode === 'navigate' ? at('./') : req).then((hit) => hit || Response.error())),
  )
})
