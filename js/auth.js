// auth.js — Autenticazione, gestione sessione e protezione rotte
import { supabase } from './supabase-client.js'
import { LOGIN_PAGE } from './config.js'

/**
 * Effettua il login con email e password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user: object|null, error: string|null}>}
 */
export async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
        return { user: null, error: 'Credenziali non valide' }
    }
    return { user: data.user, error: null }
}

/**
 * Effettua il logout e reindirizza alla pagina di login.
 */
export async function logout() {
    await supabase.auth.signOut()
    window.location.href = LOGIN_PAGE
}

/**
 * Restituisce l'utente corrente autenticato, oppure null.
 * @returns {Promise<object|null>}
 */
export async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
}

/**
 * Recupera il ruolo dell'utente corrente dalla tabella profiles.
 * @returns {Promise<'admin'|'guest'|null>}
 */
export async function getUserRole() {
    const user = await getCurrentUser()
    if (!user) return null

    const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (error || !data) return null
    return data.role
}

/**
 * Recupera l'associazione dell'utente corrente (per guest).
 * @returns {Promise<string|null>} UUID dell'associazione o null
 */
export async function getAssociazione() {
    const user = await getCurrentUser()
    if (!user) return null

    const { data, error } = await supabase
        .from('profiles')
        .select('associazione_id')
        .eq('id', user.id)
        .single()

    if (error || !data) return null
    return data.associazione_id
}

/**
 * Recupera il display_name dell'utente corrente dalla tabella profiles.
 * @returns {Promise<string|null>}
 */
export async function getDisplayName() {
    const user = await getCurrentUser()
    if (!user) return null
    const { data, error } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single()
    if (error || !data) return null
    return data.display_name
}

/**
 * Guard di autenticazione. Verifica che l'utente sia autenticato e abbia
 * uno dei ruoli consentiti. Se non autenticato, reindirizza al login.
 *
 * @param {string[]} allowedRoles - Ruoli consentiti (es. ['admin'] o ['admin','guest'])
 * @returns {Promise<{user: object, role: string, associazione: string|null}|null>}
 *          Restituisce i dati utente oppure null (con redirect già avviato)
 */
export async function requireAuth(allowedRoles = ['admin', 'guest']) {
    const user = await getCurrentUser()

    if (!user) {
        window.location.href = LOGIN_PAGE
        return null
    }

    const role = await getUserRole()

    if (!role || !allowedRoles.includes(role)) {
        window.location.href = LOGIN_PAGE
        return null
    }

    const associazione = await getAssociazione()

    return { user, role, associazione }
}

/**
 * Inizializza il listener per i cambiamenti di stato dell'autenticazione.
 * Gestisce il redirect a login quando la sessione scade o l'utente fa logout.
 */
export function initAuthListener() {
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            window.location.href = LOGIN_PAGE
            return
        }

        if (event === 'TOKEN_REFRESHED' && !session) {
            // Il refresh del token è fallito: sessione non più valida
            window.location.href = LOGIN_PAGE
        }
    })
}

// Avvia il listener al caricamento del modulo
initAuthListener()
