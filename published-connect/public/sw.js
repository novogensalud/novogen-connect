/* Generado por vite.config.js al compilar. No editar a mano. */
self.__PRECARGA__ = {
  "version": "aaec5a76",
  "esenciales": [
    "./",
    "/assets/index-BYM0Pqi2.js",
    "/assets/index-CCqY9ld8.css"
  ],
  "opcionales": [
    "/assets/Isotipo-dTGZmI3s.webp",
    "/assets/Logo-BZ5nc2HE.webp",
    "/favicon.ico",
    "/icons/apple-touch-icon.png",
    "/icons/favicon-32.png",
    "/icons/icon-192.png",
    "/icons/icon-512.png",
    "/icons/icon-maskable-512.png",
    "/manifest.webmanifest"
  ]
};

/**
 * ─────────────────────────────────────────────────────────────
 *  SERVICE WORKER DE NOVOGEN CONNECT
 * ─────────────────────────────────────────────────────────────
 *
 *  Existe por dos motivos:
 *   1. Los navegadores basados en Chromium solo ofrecen instalar una web
 *      como aplicación si hay un service worker con manejador `fetch`.
 *   2. Permite que la pantalla siga abriéndose sin conexión.
 *
 *  Estrategia: primero la red, y solo si falla se recurre a la copia en
 *  caché. Así el contenido nunca se queda obsoleto.
 *
 *  ── De dónde sale la lista de precarga ──────────────────────
 *
 *  `self.__PRECARGA__` lo escribe el complemento `precargaDelBuild` de
 *  `vite.config.js` al terminar la compilación, con los archivos reales
 *  que emitió el build.
 *
 *  Antes, la lista se sacaba leyendo los `src` y `href` del HTML. Eso
 *  dejaba fuera todo lo que no aparece en el HTML: los logotipos que se
 *  importan desde JavaScript y las fuentes que referencia el CSS. Es
 *  decir, justo lo que hace falta para que la pantalla se vea bien sin
 *  conexión.
 *
 *  En desarrollo no hay build y el marcador se queda vacío: el worker
 *  ni siquiera se registra (ver `src/main.jsx`), así que no estorba.
 *
 *  ── Qué se precarga y qué no ────────────────────────────────
 *
 *  ESENCIALES  La portada, el JavaScript y el CSS. Si alguno falla, la
 *              instalación falla: un worker a medias es peor que
 *              ninguno, porque promete un sin conexión que no cumple.
 *
 *  OPCIONALES  Imágenes, iconos y manifiesto. Se intentan, y si alguno
 *              falla la instalación sigue: sin ellos la app abre igual.
 *
 *  Las fuentes NO se precargan a propósito. El build emite unas cuarenta
 *  variantes —cuatro pesos por varios subconjuntos y formatos— y el
 *  navegador solo descarga las dos o tres que necesita. Precargarlas
 *  todas sería descargar megas para tirar casi todo. Las que el
 *  navegador sí pide quedan guardadas por el manejador `fetch` en la
 *  primera visita con conexión; hasta entonces, sin conexión se ve la
 *  tipografía del sistema.
 */

const PRECARGA = self.__PRECARGA__ ?? { version: 'dev', esenciales: ['./'], opcionales: [] }

/* Todas las cachés de esta aplicación empiezan por aquí. El prefijo es
   lo que permite limpiar las versiones viejas sin tocar las de otra
   aplicación del mismo dominio: Cache Storage se comparte por origen. */
const PREFIJO = 'novogen-connect-'
const CACHE = `${PREFIJO}${PRECARGA.version}`

/**
 * Guarda los archivos del build durante la instalación. Sin esto, la
 * primera visita quedaría sin nada en caché y la pantalla no abriría
 * sin conexión hasta la segunda carga.
 */
async function precargar() {
  const cache = await caches.open(CACHE)

  /* `cache.addAll` es atómico: si uno falla, no guarda ninguno y la
     instalación se rechaza. Es justo lo que queremos para lo esencial. */
  await cache.addAll(PRECARGA.esenciales)

  /* Lo opcional va de uno en uno para que el fallo de uno no arrastre
     al resto. Se registra en consola en vez de silenciarse: si mañana
     falta un icono, queda rastro. */
  await Promise.all(
    PRECARGA.opcionales.map((url) =>
      cache.add(url).catch((error) => {
        console.warn('[sw] no se pudo precargar', url, error)
      }),
    ),
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(precargar())
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const nombres = await caches.keys()

      /* Solo versiones antiguas DE ESTA aplicación. La versión anterior
         borraba cualquier caché cuyo nombre no fuese el actual, y como
         Cache Storage se comparte por origen, eso podía llevarse por
         delante la caché de otra aplicación publicada en el mismo
         dominio. */
      const viejas = nombres.filter((n) => n.startsWith(PREFIJO) && n !== CACHE)
      await Promise.all(viejas.map((n) => caches.delete(n)))

      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  /* Solo peticiones GET del propio sitio: nada de terceros ni de envíos. */
  if (request.method !== 'GET') return
  if (new URL(request.url).origin !== self.location.origin) return

  event.respondWith(
    (async () => {
      try {
        const respuesta = await fetch(request)

        if (respuesta && respuesta.status === 200 && respuesta.type === 'basic') {
          const copia = respuesta.clone()
          /* Ligado al evento: sin `waitUntil`, el navegador puede dormir
             el worker en cuanto se devuelve la respuesta y dejar la
             escritura a medias. Es la diferencia entre creer que algo
             está guardado y que lo esté. */
          event.waitUntil(
            caches
              .open(CACHE)
              .then((cache) => cache.put(request, copia))
              .catch((error) => {
                console.warn('[sw] no se pudo guardar', request.url, error)
              }),
          )
        }

        return respuesta
      } catch (error) {
        /* `ignoreVary` es imprescindible: los archivos se sirven con
           `Vary: Origin`, y sin esto una copia guardada durante la
           precarga nunca casaría con la petición real de la página. */
        const enCache = await caches.match(request, { ignoreVary: true })
        if (enCache) return enCache

        /* Si se pide una página y no hay nada, se sirve la portada
           guardada: con HashRouter, cualquier ruta vive en ese HTML. */
        if (request.mode === 'navigate') {
          const portada = await caches.match('./', { ignoreSearch: true, ignoreVary: true })
          if (portada) return portada
        }

        throw error
      }
    })(),
  )
})
