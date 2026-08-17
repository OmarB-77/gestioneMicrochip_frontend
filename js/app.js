import { VERSION } from "./version.js"
import { initDarkMode, toggleDarkMode } from "./ui-utils.js"
import { initRouter } from "./router.js"
import { SW_PATH } from "./config.js"
import { initConnectivity } from "./connectivity.js"

async function initServiceWorker() {
    if (!("serviceWorker" in navigator)) return
    try {
        const reg = await navigator.serviceWorker.register(SW_PATH)
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

function setupUserHeader(displayName) {
    const nameEl = document.getElementById("user-display-name")
    const logoutBtn = document.getElementById("btn-logout")
    if (nameEl && displayName) nameEl.textContent = displayName
    if (logoutBtn) {
        logoutBtn.hidden = false
        logoutBtn.addEventListener("click", async () => {
            const { logout } = await import("./auth.js")
            await logout()
        })
    }
}

async function init() {
    displayVersion()
    initDarkModeToggle()
    initConnectivity()
    await initServiceWorker()
    const path = window.location.pathname
    if (path.endsWith('/') || path.endsWith('/index.html')) {
        const ctx = await initRouter()
        if (ctx) {
            setupUserHeader(ctx.displayName)
        }
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init)
} else {
    init()
}

export { initServiceWorker }
