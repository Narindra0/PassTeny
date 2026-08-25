/**
 * Pass'Teny Service Worker
 *
 * Caching strategies:
 * - Static assets (fonts, icons, CSS, JS): Cache-first
 * - App shell (HTML navigation): Network-first with offline fallback
 * - Lyrics pages (/songs/*): Stale-while-revalidate (read-heavy)
 * - Glossary/Punchlines (/glossary): Stale-while-revalidate
 * - API calls: Network-only (never cache mutations)
 * - Images: Cache-first with network fallback
 */

const CACHE_VERSION = "v1";
const STATIC_CACHE = `passteny-static-${CACHE_VERSION}`;
const PAGES_CACHE = `passteny-pages-${CACHE_VERSION}`;
const IMAGES_CACHE = `passteny-images-${CACHE_VERSION}`;

// ── App shell URLs to pre-cache on install ──
const SHELL_URLS = [
  "/",
  "/manifest.json",
  "/icons/favicon.svg",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
];

// ── Patterns that should be served from cache when offline ──
const LYRICS_PATTERN = /^\/songs\/[^/]+\/?$/;
const GLOSSARY_PATTERN = /^\/glossary\/?$/;
const PUNCHLINES_PATTERN = /^\/glossary\/?$/;
const TAGS_PATTERN = /^\/tags\/?$/;
const CHART_PATTERN = /^\/chart\/?$/;
const DISCOVER_PATTERN = /^\/discover\/?$/;
const ARTISTS_PATTERN = /^\/artists\/[^/]+\/?$/;
const ALBUMS_PATTERN = /^\/albums\/[^/]+\/?$/;

// Pages eligible for offline caching (stale-while-revalidate)
const OFFLINE_PAGE_PATTERNS = [
  LYRICS_PATTERN,
  GLOSSARY_PATTERN,
  TAGS_PATTERN,
  CHART_PATTERN,
  DISCOVER_PATTERN,
  ARTISTS_PATTERN,
  ALBUMS_PATTERN,
];

// ── Install: pre-cache the app shell ──
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(SHELL_URLS).catch((err) => {
        console.warn("[SW] Failed to pre-cache some shell URLs:", err);
      });
    })
  );
  // Activate immediately without waiting for old SW to die
  self.skipWaiting();
});

// ── Activate: clean up old caches ──
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => {
            return (
              key.startsWith("passteny-") &&
              key !== STATIC_CACHE &&
              key !== PAGES_CACHE &&
              key !== IMAGES_CACHE
            );
          })
          .map((key) => caches.delete(key))
      );
    })
  );
  // Claim all open clients immediately
  self.clients.claim();
});

// ── Fetch handler ──
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip API calls (never cache mutations)
  if (url.pathname.startsWith("/api/")) return;

  // Skip Chrome extension requests
  if (!url.protocol.startsWith("http")) return;

  // ── Strategy: Static assets → Cache-first ──
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ── Strategy: Images → Cache-first with network fallback ──
  if (isImage(url.pathname, request)) {
    event.respondWith(cacheFirst(request, IMAGES_CACHE));
    return;
  }

  // ── Strategy: Offline-eligible pages → Stale-while-revalidate ──
  if (isOfflinePage(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, PAGES_CACHE));
    return;
  }

  // ── Strategy: Other HTML navigation → Network-first ──
  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(networkFirstWithOffline(request));
    return;
  }
});

// ═══════════════════════════════════════════════════════════════════════
// Caching strategies
// ═══════════════════════════════════════════════════════════════════════

/**
 * Cache-first: serve from cache, fall back to network.
 * Good for static assets that rarely change.
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
  }
}

/**
 * Stale-while-revalidate: serve from cache immediately,
 * update cache in background. Good for content pages.
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => {
      // Network failed — return cached version if available
      return cached;
    });

  // Return cached version immediately if available,
  // otherwise wait for network
  return cached || fetchPromise;
}

/**
 * Network-first: try network, fall back to cache, then offline page.
 * Good for general HTML navigation.
 */
async function networkFirstWithOffline(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      // Cache successful navigations for offline
      const cache = await caches.open(PAGES_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Network failed — try cache
    const cached = await caches.match(request);
    if (cached) return cached;

    // Last resort: offline fallback page
    const offlinePage = await caches.match("/offline");
    if (offlinePage) return offlinePage;

    return new Response("Offline", {
      status: 503,
      statusText: "Service Unavailable",
      headers: { "Content-Type": "text/plain" },
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// URL classifiers
// ═══════════════════════════════════════════════════════════════════════

function isStaticAsset(pathname) {
  return (
    pathname.endsWith(".js") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".woff2") ||
    pathname.endsWith(".woff") ||
    pathname.endsWith(".ttf") ||
    pathname === "/manifest.json" ||
    pathname.startsWith("/icons/")
  );
}

function isImage(pathname, request) {
  const accept = request.headers.get("accept") || "";
  return (
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".gif") ||
    pathname.endsWith(".webp") ||
    pathname.endsWith(".svg") ||
    accept.includes("image/")
  );
}

function isOfflinePage(pathname) {
  return OFFLINE_PAGE_PATTERNS.some((pattern) => pattern.test(pathname));
}
