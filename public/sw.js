/* Caporal — service worker
 *
 * Hace dos cosas y nada más: permite instalar la app en el teléfono y acelera
 * los archivos estáticos. No toca las navegaciones ni los datos.
 *
 * La versión anterior interceptaba las navegaciones para mostrar una pantalla
 * propia de "sin conexión", y en el camino podía devolver `Response.error()`.
 * Eso es exactamente lo que el navegador muestra como "This page couldn't
 * load", incluso con el servidor sano. Un service worker que se mete entre el
 * usuario y su app tiene que ser intachable; el nuestro no ganaba nada con
 * hacerlo, así que dejó de hacerlo.
 */

const VERSION = "caporal-v2";
const ASSETS = `${VERSION}-assets`;

self.addEventListener("install", () => {
  // Sin precarga: nada que descargar significa nada que pueda fallar al instalar.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Las mutaciones nunca se sirven de caché ni se reintentan a ciegas.
  if (request.method !== "GET") return;

  // Las navegaciones las resuelve el navegador. Si no hay señal, mostrará su
  // propia pantalla de error, que es honesta y siempre funciona.
  if (request.mode === "navigate") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Datos siempre frescos: un saldo cacheado es peor que ningún saldo.
  if (url.pathname.startsWith("/api/")) return;

  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:css|js|woff2?|png|svg|jpg|webp|ico)$/.test(url.pathname);

  if (!isStatic) return;

  event.respondWith(serveStatic(request));
});

/**
 * Caché primero, red por detrás. Pase lo que pase devuelve una respuesta real:
 * nunca `undefined`, nunca `Response.error()`. Si todo falla, se deja pasar el
 * error de red original, que el navegador ya sabe explicar.
 */
async function serveStatic(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request);

  if (hit) {
    // Refresca en segundo plano sin bloquear ni poder romper la respuesta.
    void fetch(request)
      .then((response) => {
        if (response.ok) return cache.put(request, response.clone());
      })
      .catch(() => {});
    return hit;
  }

  const response = await fetch(request);
  if (response.ok) {
    void cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}
