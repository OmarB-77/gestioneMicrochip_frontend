// ui-utils.js — Utility UI: toast, gestione errori form, dark mode
// Requirements: 13.5, 13.6, 16.1, 16.5

const TOAST_DURATION_MS = 3000
const THEME_STORAGE_KEY = 'theme'

// ==========================================================================
// Toast
// ==========================================================================

/**
 * Mostra un messaggio toast in fondo allo schermo.
 * Si auto-chiude dopo 3 secondi.
 * @param {string} message - Testo del messaggio
 * @param {'info'|'success'|'error'} type - Tipo di toast
 */
export function showToast(message, type = 'info') {
    // Rimuovi eventuali toast già presenti
    const existing = document.querySelector('.toast')
    if (existing) {
        existing.remove()
    }

    const toast = document.createElement('div')
    toast.className = 'toast'
    if (type === 'success') toast.classList.add('toast-success')
    if (type === 'error') toast.classList.add('toast-error')
    toast.setAttribute('role', 'status')
    toast.setAttribute('aria-live', 'polite')
    toast.textContent = message

    document.body.appendChild(toast)

    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove()
        }
    }, TOAST_DURATION_MS)
}

// ==========================================================================
// Form Error Handling
// ==========================================================================

/**
 * Evidenzia un campo come non valido e mostra il messaggio di errore.
 * Req 16.1: evidenziazione visiva con indicatore adiacente al campo.
 * @param {HTMLElement} fieldElement - L'input/select/textarea
 * @param {string} message - Messaggio di errore
 */
export function showFieldError(fieldElement, message) {
    if (!fieldElement) return

    fieldElement.classList.add('invalid')

    // Cerca lo span .error-msg fratello dell'input
    const errorSpan = fieldElement.parentElement
        ? fieldElement.parentElement.querySelector('.error-msg')
        : null

    if (errorSpan) {
        errorSpan.textContent = message
    }
}

/**
 * Rimuove l'evidenziazione di errore da un campo.
 * @param {HTMLElement} fieldElement - L'input/select/textarea
 */
export function clearFieldError(fieldElement) {
    if (!fieldElement) return

    fieldElement.classList.remove('invalid')

    const errorSpan = fieldElement.parentElement
        ? fieldElement.parentElement.querySelector('.error-msg')
        : null

    if (errorSpan) {
        errorSpan.textContent = ''
    }
}

/**
 * Rimuove tutti gli errori di validazione da un form.
 * @param {HTMLFormElement} formElement - Il form da ripulire
 */
export function clearAllErrors(formElement) {
    if (!formElement) return

    const invalidFields = formElement.querySelectorAll('.invalid')
    invalidFields.forEach(field => field.classList.remove('invalid'))

    const errorSpans = formElement.querySelectorAll('.error-msg')
    errorSpans.forEach(span => { span.textContent = '' })
}

/**
 * Scrolla la vista al primo campo con errore nel form.
 * Req 16.5: posizionare la vista sul primo campo con errore.
 * @param {HTMLFormElement} formElement - Il form contenente gli errori
 */
export function scrollToFirstError(formElement) {
    if (!formElement) return

    const firstInvalid = formElement.querySelector('.invalid')
    if (firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' })
        firstInvalid.focus()
    }
}

// ==========================================================================
// Dark Mode
// ==========================================================================

/**
 * Inizializza il tema dark mode leggendo la preferenza da localStorage.
 * Deve essere chiamata al caricamento di ogni pagina.
 * Req 13.6: la preferenza è gestita solo dall'interazione utente, MAI dal sistema.
 */
export function initDarkMode() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)

    if (savedTheme === 'dark') {
        applyDarkMode(true)
    } else {
        applyDarkMode(false)
    }
}

/**
 * Inverte lo stato del dark mode, persiste la preferenza e aggiorna l'UI.
 * Req 13.5, 13.6: toggle esplicito, persistenza in localStorage.
 */
export function toggleDarkMode() {
    const isDark = document.body.classList.contains('dark')
    const newMode = !isDark

    applyDarkMode(newMode)
    localStorage.setItem(THEME_STORAGE_KEY, newMode ? 'dark' : 'light')
}

/**
 * Applica o rimuove il tema scuro sull'interfaccia.
 * @param {boolean} enable - true per attivare il dark mode
 */
function applyDarkMode(enable) {
    const darkLink = document.getElementById('dark-theme-link')

    if (enable) {
        document.body.classList.add('dark')
        if (darkLink) darkLink.disabled = false
    } else {
        document.body.classList.remove('dark')
        if (darkLink) darkLink.disabled = true
    }
}
