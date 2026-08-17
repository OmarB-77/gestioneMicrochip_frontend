// config.js — Configurazione base path per deployment su GitHub Pages
// Rileva automaticamente il base path in base all'URL corrente.
// Funziona sia in locale (/) sia su GitHub Pages (/gestioneMicrochip_frontend/)

/**
 * Calcola il base path dell'applicazione a partire dall'URL corrente.
 * - Se siamo in una pagina sotto pages/, risale di un livello.
 * - Se siamo alla root o in index.html, usa la directory corrente.
 * @returns {string} Il base path con trailing slash (es. '/' o '/gestioneMicrochip_frontend/')
 */
function getBasePath() {
    const path = window.location.pathname
    // Se siamo in una pagina sotto pages/, risaliamo al livello dell'app
    const pagesIdx = path.lastIndexOf('/pages/')
    if (pagesIdx !== -1) {
        return path.substring(0, pagesIdx + 1)
    }
    // Se siamo alla root o in index.html, estraiamo la directory
    const lastSlash = path.lastIndexOf('/')
    return path.substring(0, lastSlash + 1)
}

export const BASE_PATH = getBasePath()
export const LOGIN_PAGE = BASE_PATH + 'pages/login.html'
export const HOME_PAGE = BASE_PATH + 'index.html'
export const SW_PATH = BASE_PATH + 'sw.js'
