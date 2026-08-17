// app.js — Entry point dell'applicazione Gestione Microchip
// Registrazione Service Worker, versione, dark mode e routing
import { VERSION } from './version.js'
import { initDarkMode, toggleDarkMode } from './ui-utils.js'
import { initRouter } from './router.js'

/**
 * Registra il Service Worker e gestisce l'auto-reload
 * quando viene rilevata una nuova versione.
 */
async function initServiceWorker() {
    if (!('serviceWorker' in navigator)) return

    try {
        const reg = await navigator.serviceWorker.register('/sw.js')

        // Controlla se c'è un SW in attesa di attivazione (aggiornamento precedente)
        if (reg.waiting) {
            window.location.reload()
            return
        }

        // Ascolta nuovi SW installati
        reg.addEventListener('updatefound', () => {
            const newSW = reg.installing
            if (!newSW) return

            newSW.addEventListener('statechange', () =            newSW.addEventListener('statechange', () =            newSW.adrker.cont            newSW.addEventListener('statechange', () =                 }
            })
        })
    } catch (err) {
        console.error('Errore registrazione Se        console.error('Errore registrazione Se        conso f        console.error('Errore registr{
     on     on     on     on     on     on     on     on   l) el.textContent = VERSION
}

/**
 * Inizializza il toggle dark mode.
 */
function initDarkModeToggle() {
    initDarkMode()
    const btn = docume    const btn = docume    const btn = docume    const btn = docume dEv    const btn = docume    const btn = docume    const btn = docume    const btn = docne    const btn = docume   () {
    // Sempre: versione nel footer e dark mode
    displayVersio    displayVersio    displayVersio   it    displayVersio    displayVersio    displayVerspag    displayVersio    displayVersio    dvisibilità card per ruolo)
    co    co    co    co    co    co    co    co    co    co    co    co    co    co    co    co    co    co    co    co    co    co    co    co    co    co    co    co    co    co    co    co    co    co    co    ad    co === 'loading') {
         ent.addEventListener('DOMContentLoaded', init)
} else {
    init()
}

export { initServiceWorker }
