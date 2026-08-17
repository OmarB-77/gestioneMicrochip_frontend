// connectivity.js — Monitoraggio connettività di rete e gestione offline
// Requirements: 14.5, 14.6, 16.3

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-client.js'
import { showToast } from './ui-utils.js'

const POLL_INTERVAL_MS = 10000
const HEALTH_TIMEOUT_MS = 5000

let online = true
let pollIntervalId = null

// ==========================================================================
// Health Check
// ==========================================================================

/**
 * Esegue un controllo di raggiungibilità verso Supabase.
 * Usa HEAD su /rest/v1/ con timeout di 5 secondi.
 * @returns {Promise<boolean>} true se il server risponde, false altrimenti
 */
async function checkConnectivity() {
    try {
        const resp = await fetch(SUPABASE_URL + '/rest/v1/', {
            method: 'HEAD',
            headers: { 'apikey': SUPABASE_ANON_KEY },
            signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS)
        })
        return resp.ok
    } catch {
        return false
    }
}

// ==========================================================================
// Offline Banner
// ==========================================================================

/**
 * Mostra il banner di assenza connessione in cima alla pagina.
 */
function showOfflineBanner() {
    if (document.querySelector('.offline-banner')) return
    const banner = document.createElement('div')
    banner.className = 'offline-banner'
    banner.setAttribute('role', 'alert')
    banner.setAttribute('aria-live', 'assertive')
    banner.textContent = 'Nessuna connessione di rete'
    document.body.insertBefore(banner, document.body.firstChild)
}

/**
 * Rimuove il banner di assenza connessione.
 */
function hideOfflineBanner() {
    const banner = document.querySelector('.offline-banner')
    if (banner) banner.remove()
}

// ==========================================================================
// State Update
// ==========================================================================

/**
 * Aggiorna lo stato globale di connettività e l'UI.
 * @param {boolean} isReachable - true se la rete è raggiungibile
 */
function updateOnlineState(isReachable) {
    const wasOnline = online
    online = isReachable

    if (isReachable && !wasOnline) {
        hideOfflineBanner()
    } else if (!isReachable && wasOnline) {
        showOfflineBanner()
    }
}

// ==========================================================================
// Polling Loop
// ==========================================================================

async function poll() {
    const reachable = await checkConnectivity()
    updateOnlineState(reachable)
}

// ==========================================================================
// Public API
// ==========================================================================

/**
 * Avvia il monitoraggio della connettività.
 * - Polling ogni 10 secondi verso Supabase healthcheck
 * - Listener eventi browser online/offline come fallback veloce
 */
export function initConnectivity() {
    // Esegui un check immediato
    poll()

    // Polling periodico
    pollIntervalId = setInterval(poll, POLL_INTERVAL_MS)

    // Fallback rapido tramite eventi browser
    window.addEventListener('offline', () => {
        updateOnlineState(false)
    })

    window.addEventListener('online', () => {
        // Quando il browser segnala online, verifica con il server
        poll()
    })
}

/**
 * Restituisce lo stato corrente della connettività.
 * @returns {boolean} true se la rete è raggiungibile
 */
export function isNetworkAvailable() {
    return online
}

/**
 * Verifica la connettività prima di un'operazione di scrittura.
 * Se offline, mostra un toast e preserva i dati del form.
 * @param {HTMLFormElement} [formElement] - Il form da preservare (non viene toccato)
 * @returns {boolean} true se online e l'operazione può procedere, false se offline
 */
export function requireNetwork(formElement) {
    if (online) return true

    showToast('Questa operazione richiede una connessione di rete', 'error')
    // I dati del form vengono preservati: non effettuiamo alcun reset
    return false
}
