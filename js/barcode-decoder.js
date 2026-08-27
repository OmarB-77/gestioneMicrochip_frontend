/**
 * Barcode decoder for browser — extracts CF from CIE/TS card photos.
 * Uses html5-qrcode library (already imported for live scanner).
 * Decodes CODE_39 barcodes from image files to extract Codice Fiscale.
 * 
 * html5-qrcode supports decoding from File objects via scanFile/scanFileV2.
 * This requires a hidden container element in the DOM.
 */

import { Html5Qrcode } from 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/+esm'

const CONTAINER_ID = 'barcode-temp-container'
const CF_PATTERN = /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/

/**
 * Wraps a promise with a timeout to prevent indefinite blocking (e.g. on mobile).
 * @param {Promise} promise - The promise to wrap
 * @param {number} ms - Timeout in milliseconds
 * @returns {Promise}
 */
function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
    ])
}

/**
 * Ensures the hidden container element exists in the DOM.
 * html5-qrcode needs a container for internal rendering even for file scanning.
 */
function ensureContainer() {
    let container = document.getElementById(CONTAINER_ID)
    if (!container) {
        container = document.createElement('div')
        container.id = CONTAINER_ID
        container.style.display = 'none'
        document.body.appendChild(container)
    }
    return CONTAINER_ID
}

/**
 * Decode a barcode from an image file.
 * Includes a 10s timeout to prevent hanging on mobile where scanFile may never resolve.
 * @param {File} imageFile - Image file containing a barcode
 * @returns {Promise<string|null>} Decoded text or null if not found
 */
export async function decodeBarcodeFromImage(imageFile) {
    if (!imageFile) return null

    const containerId = ensureContainer()

    try {
        const scanner = new Html5Qrcode(containerId)

        // Guard: ensure scanFile is available (defensive check for different lib versions)
        if (typeof scanner.scanFile !== 'function') {
            return null
        }

        const decodedText = await withTimeout(
            scanner.scanFile(imageFile, /* showImage= */ false),
            10000 // 10 second timeout
        )
        try { await scanner.clear() } catch { /* ignore cleanup errors */ }
        return decodedText || null
    } catch {
        // Barcode not found, decoding error, or timeout — expected for many images
        try {
            const scanner = new Html5Qrcode(containerId)
            await scanner.clear()
        } catch { /* ignore cleanup errors */ }
        return null
    }
}

/**
 * Extract Codice Fiscale from a CIE/TS image barcode.
 * Validates the result matches the Italian CF pattern (16 chars: 6 letters, 2 digits, 1 letter, 2 digits, 1 letter, 3 digits, 1 letter).
 * 
 * @param {File} imageFile - Image file from CIE retro or TS retro
 * @returns {Promise<string|null>} 16-char CF or null
 */
export async function extractCFFromBarcode(imageFile) {
    const decoded = await decodeBarcodeFromImage(imageFile)
    if (!decoded) return null

    const text = decoded.toUpperCase().replace(/\s/g, '')

    if (CF_PATTERN.test(text)) {
        return text
    }

    // Some barcodes may have extra characters — try to find CF pattern within
    const match = text.match(/[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]/)
    if (match) {
        return match[0]
    }

    return null
}
