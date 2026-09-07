const CACHE_NAME = "dojo-deckbuilder-companion-v3";
const CACHE_PREFIX = "dojo-deckbuilder-companion-";
const scopeUrl = new URL(self.registration.scope);
const scoped = (path) => new URL(path, scopeUrl).toString();
const PRECACHE = [scoped("./"), scoped("favicon.svg")];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(scopeUrl.pathname)) return;
  if (url.pathname.endsWith("/build.json") || url.pathname.endsWith("/rules-manifest.json")) return;

  // Vite bundles are content-addressed by filename. Never let our runtime cache
  // serve an older JS/CSS chunk into a newer React application tree.
  const isBundledAsset = url.pathname.startsWith(`${scopeUrl.pathname}assets/`);
  if (isBundledAsset) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const cachedResponse = response.clone();
            event.waitUntil(
              caches.open(CACHE_NAME)
                .then((cache) => cache.put(scoped("./"), cachedResponse))
                .catch(() => undefined),
            );
          }
          return response;
        })
        .catch(() => caches.match(scoped("./"))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        event.waitUntil(
          fetch(request)
            .then((response) => {
              if (!response.ok) return;
              const cachedResponse = response.clone();
              return caches.open(CACHE_NAME).then((cache) => cache.put(request, cachedResponse));
            })
            .catch(() => undefined),
        );
        return cached;
      }

      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const cachedResponse = response.clone();
            event.waitUntil(
              caches.open(CACHE_NAME)
                .then((cache) => cache.put(request, cachedResponse))
                .catch(() => undefined),
            );
          }
          return response;
        });
    }),
  );
});
