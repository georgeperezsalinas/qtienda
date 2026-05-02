const CACHE = "qtienda-v1";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener("fetch", (e) => {
  // Solo interceptar peticiones de navegación (páginas)
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).catch(() => caches.match("/") || new Response("Offline", { status: 503 }))
    );
    return;
  }
  e.respondWith(fetch(e.request));
});
