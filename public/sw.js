/*
 * Service worker: zorgt dat de app zonder internet start.
 *
 * Bewust met de hand geschreven en klein gehouden. De gegevens zelf staan in
 * IndexedDB en gaan hier niet doorheen; dit gaat alleen over de app-schil.
 */

const VERSION = "v1";
const SHELL = `schil-${VERSION}`;
const ASSETS = `bestanden-${VERSION}`;

// Diensten die alleen zin hebben mét internet. Nooit cachen: een oud antwoord
// is hier verwarrender dan geen antwoord.
const ALLEEN_ONLINE = ["/api/geocode", "/api/route"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.add("/")).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((namen) =>
        Promise.all(
          namen
            .filter((naam) => naam !== SHELL && naam !== ASSETS)
            .map((naam) => caches.delete(naam)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (ALLEEN_ONLINE.some((pad) => url.pathname.startsWith(pad))) return;

  // Paginabezoek: eerst het net, anders de bewaarde schil.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const kopie = response.clone();
          caches.open(SHELL).then((cache) => cache.put("/", kopie));
          return response;
        })
        .catch(() => caches.match("/", { ignoreSearch: true })),
    );
    return;
  }

  // Bestanden met een hash in de naam veranderen nooit: eerst de cache.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (bewaard) =>
          bewaard ??
          fetch(request).then((response) => {
            const kopie = response.clone();
            caches.open(ASSETS).then((cache) => cache.put(request, kopie));
            return response;
          }),
      ),
    );
    return;
  }

  // De rest: tonen wat er is en ondertussen verversen.
  event.respondWith(
    caches.match(request).then((bewaard) => {
      const vanHetNet = fetch(request)
        .then((response) => {
          const kopie = response.clone();
          caches.open(ASSETS).then((cache) => cache.put(request, kopie));
          return response;
        })
        .catch(() => bewaard);

      return bewaard ?? vanHetNet;
    }),
  );
});
