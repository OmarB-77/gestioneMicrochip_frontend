// Service Worker — Gestione Microchip PWA
// Strategia: Network-first con fallback cache, timeout 3 secondi

const CACHE_NAME = 'microchip-v1.4.2'
const NETWORK_TIMEOUT = 3000

// Install: pre-cache shell minimo (opzionale, il network-first popola la cache)
self.addEventListener('install', (event) => {
    self.skipWaiting()
})

// Activate: elimina cache vecchie e prende il controllo dei client
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    )
})

// Fetch: network-first con timeout 3s, fallback a cache
self.addEventListener('fetch', (event) => {
    // Ignora richieste non-GET (POST, PUT, DELETE non cacheable)
    if (event.request.method !== 'GET') return

    // Ignora richieste verso API Supabase (non cacheare dati dinamici di auth/realtime)
    const url = new URL(event.request.url)
    if (url.pathname.startsWith('/auth/') || url.pathname.startsWith('/rest/')) return

    event.respondWith(networkFirstWithTimeout(event.request))
})

/**
 * Tenta il network con timeout di 3 secondi.
 * Se il network risponde in tempo, aggiorna la cache e restituisce la risposta.
 * Se il network fallisce o scade il timeout, restituisce dalla cache (se disponibile).
 */
async function networkFirstWithTimeout(request) {
    try {
        const response = await promiseWithTimeout(
            fetch(request),
            NETWORK_TIMEOUT
        )

        // Salva in cache solo risposte valide
        if (response && response.status === 200 && response.type === 'basic') {
            const cache = await caches.open(CACHE_NAME)
            cache.put(request, response.clone())
        }

        return response
    } catch (err) {
        // Network fallito o timeout: prova dalla cache
        const cached = await caches.match(request)
        if (cached) return cached

        // Nessuna cache disponibile: restituisci errore offline
        return new Response('Offline - contenuto non disponibile in cache', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
        })
    }
}

/**
 * Wrappa una Promise con un timeout.
 * Se la promise non si risolve entro ms millisecondi, viene rigettata.
 */
function promiseWithTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Network timeout')), ms)
        promise
            .then(value => {
                clearTimeout(timer)
                resolve(value)
            })
            .catch(err => {
                clearTimeout(timer)
                reject(err)
            })
    })
}
