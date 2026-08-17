// app.js — Entry point dell'applicazione Gestione Microchip
// Registrazione Service Worker e gestione auto-update

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
            // Nuovo SW già pronto: ricarica per attivarlo
            window.location.reload()
            return
        }

        // Ascolta nuovi SW installati
        reg.addEventListener('updatefound', () => {
            const newSW = reg.installing
            if (!newSW) return

            newSW.addEventListener('statechange', () => {
                // Quando il nuovo SW è attivato e c'è già un controller attivo
                // (ovvero non è la prima installazione), ricarica la pagina
                if (newSW.state === 'activated' && navigator.serviceWorker.controller) {
                    window.location.reload()
                }
            })
        })
    } catch (err) {
        console.error('Errore registrazione Service Worker:', err)
    }
}

/**
 * Inizializzazione dell'applicazione.
 */
async function init() {
    await initServiceWorker()
}

// Avvia l'app quando il DOM è pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
} else {
    init()
}

export { initServiceWorker }
