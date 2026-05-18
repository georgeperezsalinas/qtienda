// qtienda — Service Worker v2
// Estrategia: Cache-first para assets estáticos, Network-first para navegación

const CACHE_STATIC = "qtienda-static-v2";
const CACHE_PAGES = "qtienda-pages-v2";
const CACHE_IMAGES = "qtienda-images-v2";

// Assets que siempre queremos en caché (shell de la app)
const PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/icon/icon-192.png",
  "/icon/icon-512.png",
  "/offline",   // página offline que debes crear (ver abajo)
];

// ── Install: pre-cachear shell ──────────────────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ── Activate: limpiar caches viejos ────────────────────────
self.addEventListener("activate", (e) => {
  const VALID = [CACHE_STATIC, CACHE_PAGES, CACHE_IMAGES];
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !VALID.includes(k)).map((k) => caches.delete(k)))
    )
  );
  e.waitUntil(clients.claim());
});

// ── Fetch: estrategia por tipo de recurso ──────────────────
self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Solo interceptar mismo origen + GET
  if (request.method !== "GET") return;

  // API calls → siempre network, nunca cachear
  if (url.pathname.startsWith("/api/")) return;

  // Imágenes → cache-first, fallback network, guardar en caché
  if (request.destination === "image") {
    e.respondWith(
      caches.open(CACHE_IMAGES).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const fresh = await fetch(request);
          if (fresh.ok) cache.put(request, fresh.clone());
          return fresh;
        } catch {
          return new Response("", { status: 404 });
        }
      })
    );
    return;
  }

  // Navegación (HTML) → network-first, fallback caché, fallback offline
  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_PAGES).then((c) => c.put(request, clone));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match("/offline");
          return offline || new Response("<h1>Sin conexión</h1>", {
            status: 503,
            headers: { "Content-Type": "text/html" },
          });
        })
    );
    return;
  }

  // Scripts y CSS → stale-while-revalidate
  if (["script", "style"].includes(request.destination)) {
    e.respondWith(
      caches.open(CACHE_STATIC).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request).then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        });
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Resto → network directo
  // (no interceptar para no degradar performance)
});

// ── Push Notifications ─────────────────────────────────────
self.addEventListener("push", (e) => {
  if (!e.data) return;
  let data = {};
  try { data = e.data.json(); } catch { data = { title: "qtienda", body: e.data.text() }; }

  e.waitUntil(
    self.registration.showNotification(data.title || "qtienda", {
      body: data.body || "",
      icon: data.icon || "/icon/icon-192.png",
      badge: data.badge || "/icon/icon-96.png",
      image: data.image,
      data: { url: data.url || "/dashboard" },
      vibrate: [100, 50, 100],
      tag: data.tag || "qtienda-default",       // agrupa notifs del mismo tipo
      renotify: true,
      actions: data.actions || [],
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/dashboard";
  e.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        const existing = list.find((c) => c.url.includes(self.location.origin));
        if (existing) return existing.focus().then((c) => c.navigate(url));
        return clients.openWindow(url);
      })
  );
});

// ── Background Sync (opcional, para pedidos offline) ───────
self.addEventListener("sync", (e) => {
  if (e.tag === "sync-orders") {
    // Aquí puedes reintentar requests fallidos guardados en IndexedDB
    // e.waitUntil(syncPendingOrders());
  }
});
