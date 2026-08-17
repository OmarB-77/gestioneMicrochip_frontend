import { VERSION } from "./version.js"
import { initDarkMode, toggleDarkMode } from "./ui-utils.js"
import { initRouter } from "./router.js"

async function initServiceWorker() {
    if (!("serviceWorker" in navigator)) return
    try {
        const reg = await navigator.serviceWorker.register("/sw.js")
        if (reg.waiting) { window.location.reload(); return }
        reg.addEventListener("updatefound", () => {
            const newSW = reg.installing
            if (!newSW) return
            newSW.addEventListener("statechange", () => {
                if (newSW.state === "activated" && navigator.serviceWorker.controller) {
                    window.location.reload()
                }
            })
        })
    } catch (err) {
        console.error("Errore registrazione SW:", err)
    }
}

function displayVersion() {
    const el = document.getElementById("version")
    if (el) el.textContent = VERSION
}

function initDarkModeToggle() {
    initDarkMode()
    const btn = document.getElementById("dark-mode-toggle")
    if (btn) btn.addEventListener("click", toggleDarkMode)
}

async function init() {
    displayVersion()
    initDarkModeToggle()
    await initServiceWorker()
    const path = window.location.pathname
    if (path === "/" || path === "/index.html" || path.endsWith("/index.html")) {
        await initRouter()
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init)
} else {
    init()
}

export { initServiceWorker }
