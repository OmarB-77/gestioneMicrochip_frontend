/**
 * Modulo OCR per estrazione dati da carta d'identità elettronica.
 * Utilizza tesseract.js v5 per OCR interamente client-side.
 * Le immagini NON vengono mai inviate a server esterni.
 * 
 * Requirements: 6.1, 6.2, 6.5
 */

import Tesseract from 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js'

/**
 * Pre-processa un'immagine: carica, ridimensiona a max `maxSize` px, converte in grayscale.
 * @param {File} imageFile - File immagine da processare
 * @param {number} [maxSize=2000] - Dimensione massima in pixel (larghezza o altezza)
 * @returns {Promise<HTMLCanvasElement>} - Canvas pronto per OCR
 */
export async function preprocessImage(imageFile, maxSize = 2000) {
    if (!imageFile || !(imageFile instanceof File || imageFile instanceof Blob)) {
        throw new Error('File immagine non valido')
    }

    const objectUrl = URL.createObjectURL(imageFile)

    try {
        const img = await loadImage(objectUrl)
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        // Calcola dimensioni mantenendo aspect ratio
        let { width, height } = img
        if (width > maxSize || height > maxSize) {
            const ratio = Math.min(maxSize / width, maxSize / height)
            width = Math.round(width * ratio)
            height = Math.round(height * ratio)
        }

        canvas.width = width
        canvas.height = height

        // Disegna immagine ridimensionata
        ctx.drawImage(img, 0, 0, width, height)

        // Converti in grayscale
        const imageData = ctx.getImageData(0, 0, width, height)
        const data = imageData.data
        for (let i = 0; i < data.length; i += 4) {
            const gray = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114)
            data[i] = gray
            data[i + 1] = gray
            data[i + 2] = gray
            // alpha rimane invariato
        }
        ctx.putImageData(imageData, 0, 0)

        return canvas
    } finally {
        URL.revokeObjectURL(objectUrl)
    }
}

/**
 * Estrae il testo MRZ da un'immagine (retro della carta d'identità).
 * Usa tesseract.js con language 'ocrb' (fallback 'eng') e whitelist caratteri MRZ.
 * 
 * @param {File} imageFile - File immagine del retro della CIE
 * @returns {Promise<{mrzText: string|null, error: string|null}>}
 */
export async function extractMRZFromImage(imageFile) {
    let canvas = null
    let worker = null

    try {
        canvas = await preprocessImage(imageFile)

        // Crea worker tesseract.js v5
        worker = await Tesseract.createWorker('ocrb', 1, {
            errorHandler: () => {} // Suppress non-critical errors
        })

        // Configura parametri OCR per MRZ
        await worker.setParameters({
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
            tessedit_pageseg_mode: Tesseract.PSM ? Tesseract.PSM.SINGLE_BLOCK : '6'
        })

        const { data } = await worker.recognize(canvas)
        const text = data.text || ''

        // Cerca pattern MRZ: 3 righe da 30 caratteri
        const mrzText = extractMRZLines(text)

        if (mrzText) {
            return { mrzText, error: null }
        }

        return { mrzText: null, error: 'MRZ non rilevata nell\'immagine' }
    } catch (err) {
        // Fallback: prova con lingua 'eng' se 'ocrb' non disponibile
        if (err.message && (err.message.includes('ocrb') || err.message.includes('lang'))) {
            try {
                if (worker) {
                    await worker.terminate()
                    worker = null
                }

                worker = await Tesseract.createWorker('eng', 1, {
                    errorHandler: () => {}
                })

                await worker.setParameters({
                    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
                    tessedit_pageseg_mode: Tesseract.PSM ? Tesseract.PSM.SINGLE_BLOCK : '6'
                })

                if (!canvas) {
                    canvas = await preprocessImage(imageFile)
                }

                const { data } = await worker.recognize(canvas)
                const text = data.text || ''
                const mrzText = extractMRZLines(text)

                if (mrzText) {
                    return { mrzText, error: null }
                }

                return { mrzText: null, error: 'MRZ non rilevata nell\'immagine' }
            } catch (fallbackErr) {
                return { mrzText: null, error: `Errore OCR: ${fallbackErr.message || 'errore sconosciuto'}` }
            }
        }

        return { mrzText: null, error: `Errore OCR: ${err.message || 'errore sconosciuto'}` }
    } finally {
        // Pulizia memoria
        if (worker) {
            try { await worker.terminate() } catch (_) { /* ignore */ }
        }
        if (canvas) {
            const ctx = canvas.getContext('2d')
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            canvas.width = 0
            canvas.height = 0
            canvas = null
        }
    }
}

/**
 * Estrae l'indirizzo di residenza da un'immagine (fronte della carta d'identità).
 * Usa tesseract.js con language 'ita' per riconoscimento testo generico.
 * 
 * @param {File} imageFile - File immagine del fronte della CIE
 * @returns {Promise<{address: string|null, error: string|null}>}
 */
export async function extractAddressFromImage(imageFile) {
    let canvas = null
    let worker = null

    try {
        canvas = await preprocessImage(imageFile)

        // Crea worker tesseract.js v5 con lingua italiana
        worker = await Tesseract.createWorker('ita', 1, {
            errorHandler: () => {}
        })

        await worker.setParameters({
            tessedit_pageseg_mode: Tesseract.PSM ? Tesseract.PSM.SINGLE_COLUMN : '4'
        })

        const { data } = await worker.recognize(canvas)
        const text = data.text || ''

        // Cerca pattern indirizzo nel testo estratto
        const address = extractAddressFromText(text)

        // Se non trovato, non è un errore: il campo resta vuoto per inserimento manuale
        return { address: address || null, error: null }
    } catch (err) {
        return { address: null, error: `Errore OCR: ${err.message || 'errore sconosciuto'}` }
    } finally {
        // Pulizia memoria
        if (worker) {
            try { await worker.terminate() } catch (_) { /* ignore */ }
        }
        if (canvas) {
            const ctx = canvas.getContext('2d')
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            canvas.width = 0
            canvas.height = 0
            canvas = null
        }
    }
}

// --- Funzioni interne ---

/**
 * Carica un'immagine da URL in un HTMLImageElement.
 * @param {string} url - URL dell'immagine (object URL o data URL)
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('Impossibile caricare l\'immagine'))
        img.src = url
    })
}

/**
 * Estrae le 3 righe MRZ da testo OCR.
 * Cerca pattern: 3 righe consecutive di esattamente 30 caratteri MRZ validi.
 * @param {string} text - Testo OCR grezzo
 * @returns {string|null} - 90 caratteri MRZ (3 righe concatenate) o null
 */
function extractMRZLines(text) {
    if (!text) return null

    // Pulisci il testo: rimuovi spazi extra, normalizza newline
    const lines = text
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map(line => line.replace(/\s/g, '').toUpperCase())
        .filter(line => line.length > 0)

    // Cerca 3 righe consecutive di 30 caratteri MRZ validi
    const mrzCharRegex = /^[A-Z0-9<]{30}$/

    for (let i = 0; i <= lines.length - 3; i++) {
        const line1 = lines[i]
        const line2 = lines[i + 1]
        const line3 = lines[i + 2]

        if (
            mrzCharRegex.test(line1) &&
            mrzCharRegex.test(line2) &&
            mrzCharRegex.test(line3)
        ) {
            return line1 + line2 + line3
        }
    }

    // Fallback: cerca righe di ~30 caratteri con tolleranza (28-32) e normalizza
    for (let i = 0; i <= lines.length - 3; i++) {
        const candidates = [lines[i], lines[i + 1], lines[i + 2]]
        const normalized = candidates.map(line => {
            // Rimuovi caratteri non MRZ
            const cleaned = line.replace(/[^A-Z0-9<]/g, '')
            return cleaned
        })

        if (
            normalized[0].length >= 28 && normalized[0].length <= 32 &&
            normalized[1].length >= 28 && normalized[1].length <= 32 &&
            normalized[2].length >= 28 && normalized[2].length <= 32
        ) {
            // Tronca o padda a 30 caratteri
            const padded = normalized.map(line => {
                if (line.length > 30) return line.substring(0, 30)
                return line.padEnd(30, '<')
            })

            if (padded.every(line => /^[A-Z0-9<]{30}$/.test(line))) {
                return padded.join('')
            }
        }
    }

    return null
}

/**
 * Estrae un indirizzo dal testo OCR della zona VIZ della carta.
 * Cerca keyword tipici di indirizzi italiani.
 * @param {string} text - Testo OCR grezzo
 * @returns {string|null} - Indirizzo estratto o null
 */
function extractAddressFromText(text) {
    if (!text) return null

    const lines = text
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)

    // Pattern: cerca keyword "RESIDENZA" e prendi la riga successiva
    for (let i = 0; i < lines.length; i++) {
        const upperLine = lines[i].toUpperCase()
        if (upperLine.includes('RESIDENZA')) {
            // L'indirizzo potrebbe essere sulla stessa riga dopo "RESIDENZA" o sulla riga successiva
            const afterKeyword = lines[i].replace(/residenza/i, '').replace(/[:\-]/g, '').trim()
            if (afterKeyword.length > 5) {
                return afterKeyword
            }
            // Prova riga successiva
            if (i + 1 < lines.length && lines[i + 1].length > 5) {
                return lines[i + 1]
            }
        }
    }

    // Pattern: cerca tipi di via italiani
    const addressPrefixes = /^(VIA|V\.|PIAZZA|P\.ZZA|CORSO|C\.SO|VIALE|V\.LE|LARGO|L\.GO|LOCALITA'|LOC\.|CONTRADA|C\.DA|FRAZIONE|FRAZ\.)\s+/i

    for (let i = 0; i < lines.length; i++) {
        if (addressPrefixes.test(lines[i])) {
            // Potrebbe essere indirizzo su più righe (via + città/cap)
            let address = lines[i]
            // Se la riga successiva sembra un CAP o una città, aggiungi
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1]
                // CAP (5 cifre) o città
                if (/^\d{5}/.test(nextLine) || /^[A-Z]{2,}/.test(nextLine.toUpperCase())) {
                    address += ' ' + nextLine
                }
            }
            return address
        }
    }

    // Pattern: cerca formato "indirizzo, CAP Città (PROV)"
    const fullAddressPattern = /(.+,\s*\d{5}\s+[A-Za-z\s]+(\([A-Z]{2}\))?)/
    for (const line of lines) {
        const match = line.match(fullAddressPattern)
        if (match) {
            return match[1].trim()
        }
    }

    return null
}
