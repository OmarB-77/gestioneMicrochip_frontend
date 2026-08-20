/**
 * Scanner Barcode Module
 * Wrapper per html5-qrcode con supporto Code 128, EAN-13, QR Code.
 * Usa la fotocamera posteriore (environment) con timeout di 30 secondi.
 */

import { Html5Qrcode } from 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/+esm'

const SCAN_TIMEOUT_MS = 30000

const SCAN_CONFIG = {
    fps: 10,
    qrbox: { width: 250, height: 250 },
    formatsToSupport: [0, 5, 9] // QR_CODE=0, CODE_128=5, EAN_13=9
}

let activeScanner = null
let activeTimeoutId = null

/**
 * Avvia la scansione barcode/QR.
 * @param {string} containerId - ID del div dove il lettore verrà renderizzato
 * @param {function} onSuccess - Callback chiamata con il testo decodificato
 * @param {function} onError - Callback chiamata con il tipo di errore ('TIMEOUT' | 'CAMERA_ERROR')
 */
export async function startScan(containerId, onSuccess, onError) {
    // Se c'è già una scansione attiva, fermarla prima
    await stopScan()

    const scanner = new Html5Qrcode(containerId)
    activeScanner = scanner

    // Impostare timeout di 30 secondi
    activeTimeoutId = setTimeout(async () => {
        activeTimeoutId = null
        try {
            await scanner.stop()
        } catch (e) {
            // Ignora errori nello stop (potrebbe essere già fermato)
        }
        activeScanner = null
        onError('TIMEOUT')
    }, SCAN_TIMEOUT_MS)

    const onDecoded = async (decodedText) => {
        // Codice decodificato con successo
        if (activeTimeoutId) {
            clearTimeout(activeTimeoutId)
            activeTimeoutId = null
        }
        try {
            await scanner.stop()
        } catch (e) {
            // Ignora errori nello stop
        }
        activeScanner = null
        onSuccess(decodedText)
    }

    const onFrame = () => {
        // Errori intermedi di decodifica frame - ignorati
    }

    const preferredCameraId = localStorage.getItem('preferred_camera_id')

    let cameraConfig
    if (preferredCameraId) {
        cameraConfig = { deviceId: { exact: preferredCameraId } }
    } else {
        cameraConfig = { facingMode: 'environment' }
    }

    try {
        await scanner.start(cameraConfig, SCAN_CONFIG, onDecoded, onFrame)
    } catch (err) {
        // If preferred camera failed, try fallback
        if (preferredCameraId) {
            try {
                await scanner.start({ facingMode: 'environment' }, SCAN_CONFIG, onDecoded, onFrame)
            } catch (fallbackErr) {
                if (activeTimeoutId) {
                    clearTimeout(activeTimeoutId)
                    activeTimeoutId = null
                }
                activeScanner = null
                onError('CAMERA_ERROR')
            }
        } else {
            if (activeTimeoutId) {
                clearTimeout(activeTimeoutId)
                activeTimeoutId = null
            }
            activeScanner = null
            onError('CAMERA_ERROR')
        }
    }
}

/**
 * Ferma la scansione corrente se attiva.
 * Sicuro da chiamare anche se nessuna scansione è in corso.
 */
export async function stopScan() {
    if (activeTimeoutId) {
        clearTimeout(activeTimeoutId)
        activeTimeoutId = null
    }
    if (activeScanner) {
        try {
            await activeScanner.stop()
        } catch (e) {
            // Ignora errori nello stop (scanner potrebbe non essere attivo)
        }
        activeScanner = null
    }
}
