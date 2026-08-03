/**
 * Ink's service worker — hand-written rather than generated, because the app
 * only needs three rules and a build plugin would cost more than it saves.
 *
 * Bump CACHE_VERSION when the shell changes; the old caches are deleted on
 * activate. Route HTML is always network-first, and everything under
 * /_next/static is content-hashed, so a stale version can't pin you to old code
 * for longer than one navigation.
 */

const CACHE_VERSION = "v2";
const SHELL_CACHE = `ink-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `ink-assets-${CACHE_VERSION}`;
const IMAGE_CACHE = `ink-images-${CACHE_VERSION}`;

// Only the offline page is precached. The tab routes deliberately aren't: when
// the worker installs on the login screen those requests 302 to /login, and
// caching that would store the login page under /feed — so a signed-in user
// with no network would be shown a sign-in form instead of their own writing.
// The real shells get cached by navigationHandler on each successful visit,
// which is exactly when they're the right thing to keep.
const SHELL_ROUTES = ["/offline"];

const MAX_CACHED_IMAGES = 120;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Individually, so one 401/redirect can't fail the whole install.
      .then((cache) =>
        Promise.all(
          SHELL_ROUTES.map((route) =>
            cache.add(new Request(route, { credentials: "same-origin" })).catch(() => {})
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  const keep = [SHELL_CACHE, ASSET_CACHE, IMAGE_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => !keep.includes(key)).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/** Trim a runtime cache back to a bound, oldest entries first. */
async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map((key) => cache.delete(key)));
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  }
  return response;
}

/**
 * Fresh HTML when there's a network, the last copy of this route when there
 * isn't, and the offline page when we've never seen it before.
 */
async function navigationHandler(request) {
  try {
    const response = await fetch(request);
    // `redirected` means auth sent us somewhere else — storing that body under
    // the requested URL is how you end up serving /login as /feed.
    if (response.ok && !response.redirected) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (
      (await caches.match(request, { ignoreSearch: true })) ??
      (await caches.match("/offline")) ??
      new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })
    );
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Supabase REST, auth and realtime traffic is per-user and token-bearing —
  // never put it in a cache. The app handles its own offline copy of the feed
  // in IndexedDB, where it's scoped to the signed-in user and cleared on
  // sign-out. Storage images are public URLs and safe to keep.
  const isSupabase = url.hostname.endsWith(".supabase.co");
  if (isSupabase) {
    if (url.pathname.includes("/storage/v1/object/public/")) {
      event.respondWith(
        cacheFirst(request, IMAGE_CACHE).then((response) => {
          event.waitUntil(trim(IMAGE_CACHE, MAX_CACHED_IMAGES));
          return response;
        })
      );
    }
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(navigationHandler(request));
    return;
  }

  // Content-hashed build output and static icons: safe to serve from cache
  // forever, since a new build produces new filenames.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
  }
});
