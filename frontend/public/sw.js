const CACHE_VERSION = "v2";
const CACHE_NAME = `kassa-static-${CACHE_VERSION}`;
const ASSETS = ["/", "/index.html", "/manifest.webmanifest", "/placeholder.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  // Always prefer network for SPA shell to avoid stale UI; fallback to cache when offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/index.html"))),
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(request).then((response) => {
      if (response) return response;

      return fetch(request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          return networkResponse;
        })
        .catch(() => caches.match("/index.html"));
    }),
  );
});
