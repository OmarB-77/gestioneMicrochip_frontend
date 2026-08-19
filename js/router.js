// router.js — Navigazione tra pagine e protezione rotte per ruolo
import { getCurrentUser, getUserRole, getAssociazione, getDisplayName } from './auth.js'
import { LOGIN_PAGE, HOME_PAGE } from './config.js'

/**
 * Mappa delle rotte protette e i ruoli autorizzati.
 * Le pagine non elencate qui sono considerate pubbliche.
 */
const ROUTE_ROLES = {
    '/index.html': ['admin', 'guest'],
    '/pages/carica-chip.html': ['admin'],
    '/pages/impianta-chip.html': ['admin', 'guest'],
    '/pages/affida-gatto.html': ['admin', 'guest'],
    '/pages/registra-bdn.html': ['admin'],
    '/pages/cerca-chip.html': ['admin', 'guest'],
    '/pages/riepilogo.html': ['admin', 'guest'],
    '/pages/gestione-utenti.html': ['admin']
}

/**
 * Inizializza il router sulla pagina principale (index.html).
 * - Verifica autenticazione (redirect a login se non autenticato)
 * - Recupera il ruolo e nasconde le card admin se l'utente è guest
 * - Restituisce i dati dell'utente corrente
 *
 * @returns {Promise<{user: object, role: string, associazione: string|null}|null>}
 */
export async function initRouter() {
    const user = await getCurrentUser()

    if (!user) {
        window.location.href = LOGIN_PAGE
        return null
    }

    const role = await getUserRole()

    if (!role) {
        window.location.href = LOGIN_PAGE
        return null
    }

    const associazione = await getAssociazione()
    const displayName = await getDisplayName()

    return { user, role, associazione, displayName }
}

/**
 * Protegge una pagina verificando autenticazione e ruolo.
 * Da chiamare all'inizio di ogni pagina protetta.
 *
 * @param {string[]} allowedRoles - Ruoli consentiti per questa pagina
 * @returns {Promise<{user: object, role: string, associazione: string|null}|null>}
 *          Restituisce i dati utente oppure null (con redirect già avviato)
 */
export async function protectPage(allowedRoles = ['admin', 'guest']) {
    const user = await getCurrentUser()

    if (!user) {
        window.location.href = LOGIN_PAGE
        return null
    }

    const role = await getUserRole()

    if (!role || !allowedRoles.includes(role)) {
        // Utente autenticato ma senza il ruolo richiesto: torna alla home
        window.location.href = HOME_PAGE
        return null
    }

    const associazione = await getAssociazione()
    const displayName = await getDisplayName()

    return { user, role, associazione, displayName }
}

export { ROUTE_ROLES }
