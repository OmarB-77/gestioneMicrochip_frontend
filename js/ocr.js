/**
 * Modulo OCR per estrazione dati da documenti d'identità.
 * Utilizza tesseract.js v5 per OCR interamente client-side.
 * Le immagini NON vengono mai inviate a server esterni.
 * 
 * Multi-source extraction strategy (browser version):
 * 1. Barcode (html5-qrcode) → Codice Fiscale (most reliable)
 * 2. CF decode → data nascita, sesso, luogo nascita
 * 3. MRZ OCR (bottom crop + K/L fix) → nome, cognome, dates, docnum
 * 4. TS fronte OCR → nome, cognome (supplementary)
 * 5. CIE fronte OCR → indirizzo
 * 
 * Requirements: 6.1, 6.2, 6.5
 */

import Tesseract from 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js'
import { extractCFFromBarcode } from './barcode-decoder.js'
import { decodeCF } from './cf-decoder.js'

// ═══════════════════════════════════════════════════════════════════════════════
// Image preprocessing (canvas-based, no external deps)
// ═══════════════════════════════════════════════════════════════════════════════

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
        }
        ctx.putImageData(imageData, 0, 0)

        return canvas
    } finally {
        URL.revokeObjectURL(objectUrl)
    }
}

/**
 * Crop the bottom portion of an image (for MRZ zone on CIE retro).
 * @param {File} imageFile - File immagine
 * @param {number} topPercent - Percentage from top to start crop (e.g., 0.60 = bottom 40%)
 * @returns {Promise<HTMLCanvasElement>}
 */
async function cropBottomForMRZ(imageFile, topPercent = 0.60) {
    if (!imageFile) throw new Error('File immagine non valido')

    const objectUrl = URL.createObjectURL(imageFile)

    try {
        const img = await loadImage(objectUrl)

        // Only crop if landscape (card scanned horizontally)
        const isLandscape = img.width > img.height
        const cropTop = isLandscape ? Math.floor(img.height * topPercent) : 0
        const cropHeight = img.height - cropTop

        // Scale to max 2000px wide
        let width = img.width
        let height = cropHeight
        const maxSize = 2000
        if (width > maxSize || height > maxSize) {
            const ratio = Math.min(maxSize / width, maxSize / height)
            width = Math.round(width * ratio)
            height = Math.round(height * ratio)
        }

        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        canvas.width = width
        canvas.height = height

        // Draw cropped portion
        ctx.drawImage(img, 0, cropTop, img.width, cropHeight, 0, 0, width, height)

        // Grayscale + contrast enhancement
        const imageData = ctx.getImageData(0, 0, width, height)
        const data = imageData.data
        for (let i = 0; i < data.length; i += 4) {
            let gray = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114)
            // Increase contrast by pushing toward extremes
            gray = gray < 128 ? Math.max(0, gray - 30) : Math.min(255, gray + 30)
            data[i] = gray
            data[i + 1] = gray
            data[i + 2] = gray
        }
        ctx.putImageData(imageData, 0, 0)

        return canvas
    } finally {
        URL.revokeObjectURL(objectUrl)
    }
}

/**
 * Carica un'immagine da URL in un HTMLImageElement.
 * @param {string} url
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
 * Clean up a canvas to free memory.
 */
function disposeCanvas(canvas) {
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    canvas.width = 0
    canvas.height = 0
}

// ═══════════════════════════════════════════════════════════════════════════════
// MRZ character confusion fix (K/L → <)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fix the common K/L → < confusion in OCR output for MRZ text.
 * Tesseract consistently reads the MRZ filler character '<' as 'K' or 'L'.
 * 
 * @param {string} text - Raw OCR text
 * @returns {string} Corrected text
 */
function fixMRZCharConfusion(text) {
    const lines = text.split('\n')
    return lines.map(line => {
        let cleaned = line.replace(/\s/g, '').toUpperCase()

        // Only process lines that could be MRZ (25-35 chars)
        if (cleaned.length >= 25 && cleaned.length <= 35) {
            const mrzCharCount = (cleaned.match(/[A-Z0-9<]/g) || []).length
            if (mrzCharCount / cleaned.length < 0.9) return cleaned

            // Replace sequences of 2+ K and/or L with <
            cleaned = cleaned.replace(/[KL]{2,}/g, match => '<'.repeat(match.length))

            // Replace K/L adjacent to existing < characters (iterative)
            let prev = ''
            while (prev !== cleaned) {
                prev = cleaned
                cleaned = cleaned.replace(/(?<=<)[KL]/g, '<')
                cleaned = cleaned.replace(/[KL](?=<)/g, '<')
            }

            // Replace trailing K/L at end of line (MRZ lines end with padding)
            cleaned = cleaned.replace(/[KL]+$/g, match => '<'.repeat(match.length))

            // Single K/L between < characters
            cleaned = cleaned.replace(/<[KL]</g, '<<<')
        }

        return cleaned
    }).join('\n')
}

// ═══════════════════════════════════════════════════════════════════════════════
// MRZ line extraction
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Estrae le 3 righe MRZ da testo OCR.
 * Applies K/L → < fix, then looks for 3 consecutive lines of ~30 valid MRZ chars.
 * @param {string} text - Testo OCR grezzo
 * @returns {string|null} - 90 caratteri MRZ (3 righe concatenate) o null
 */
function extractMRZLines(text) {
    if (!text) return null

    // Apply K/L confusion fix
    const correctedText = fixMRZCharConfusion(text)

    const lines = correctedText
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map(line => line.replace(/\s/g, '').toUpperCase())
        .filter(line => line.length > 0)

    const mrzCharRegex = /^[A-Z0-9<]{30}$/

    // Exact match: 3 consecutive lines of exactly 30 chars
    for (let i = 0; i <= lines.length - 3; i++) {
        if (
            mrzCharRegex.test(lines[i]) &&
            mrzCharRegex.test(lines[i + 1]) &&
            mrzCharRegex.test(lines[i + 2])
        ) {
            return lines[i] + lines[i + 1] + lines[i + 2]
        }
    }

    // Fallback: tolerance 26-34 chars, normalize to 30
    for (let i = 0; i <= lines.length - 3; i++) {
        const candidates = [lines[i], lines[i + 1], lines[i + 2]]
        const normalized = candidates.map(line => line.replace(/[^A-Z0-9<]/g, ''))

        if (
            normalized[0].length >= 26 && normalized[0].length <= 34 &&
            normalized[1].length >= 26 && normalized[1].length <= 34 &&
            normalized[2].length >= 26 && normalized[2].length <= 34
        ) {
            const padded = normalized.map(line => {
                if (line.length > 30) return line.substring(0, 30)
                return line.padEnd(30, '<')
            })

            if (padded.every(line => /^[A-Z0-9<]{30}$/.test(line))) {
                return padded.join('')
            }
        }
    }

    // Third attempt: look for any 2 lines that match and find the third nearby
    for (let i = 0; i <= lines.length - 2; i++) {
        const norm1 = lines[i].replace(/[^A-Z0-9<]/g, '')
        const norm2 = lines[i + 1].replace(/[^A-Z0-9<]/g, '')

        if (norm1.length >= 28 && norm1.length <= 32 &&
            norm2.length >= 28 && norm2.length <= 32) {

            for (let j = i + 2; j <= Math.min(i + 4, lines.length - 1); j++) {
                const norm3 = lines[j].replace(/[^A-Z0-9<]/g, '')
                if (norm3.length >= 28 && norm3.length <= 32) {
                    const padded = [norm1, norm2, norm3].map(line => {
                        if (line.length > 30) return line.substring(0, 30)
                        return line.padEnd(30, '<')
                    })
                    if (padded.every(line => /^[A-Z0-9<]{30}$/.test(line))) {
                        return padded.join('')
                    }
                }
            }
        }
    }

    return null
}

// ═══════════════════════════════════════════════════════════════════════════════
// OCR extraction functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Estrae il testo MRZ da un'immagine (retro della carta d'identità).
 * Uses bottom crop + K/L fix for improved accuracy.
 * 
 * @param {File} imageFile - File immagine del retro della CIE
 * @returns {Promise<{mrzText: string|null, error: string|null}>}
 */
export async function extractMRZFromImage(imageFile) {
    const canvases = []
    let worker = null

    try {
        // Pass 1: Bottom crop (60% from top = bottom 40%) — MRZ is at the bottom
        const croppedCanvas = await cropBottomForMRZ(imageFile, 0.60)
        canvases.push(croppedCanvas)

        worker = await createMRZWorker()

        const { data } = await worker.recognize(croppedCanvas)
        let mrzText = extractMRZLines(data.text || '')

        if (mrzText) {
            return { mrzText, error: null }
        }

        // Pass 2: Larger crop (bottom 50%)
        await worker.terminate()
        worker = null
        disposeCanvas(canvases.pop())

        const largerCropCanvas = await cropBottomForMRZ(imageFile, 0.50)
        canvases.push(largerCropCanvas)

        worker = await createMRZWorker()
        const { data: data2 } = await worker.recognize(largerCropCanvas)
        mrzText = extractMRZLines(data2.text || '')

        if (mrzText) {
            return { mrzText, error: null }
        }

        // Pass 3: Full image (for portrait orientation or different card layouts)
        await worker.terminate()
        worker = null
        disposeCanvas(canvases.pop())

        const fullCanvas = await preprocessImage(imageFile)
        canvases.push(fullCanvas)

        worker = await createMRZWorker()
        const { data: data3 } = await worker.recognize(fullCanvas)
        mrzText = extractMRZLines(data3.text || '')

        if (mrzText) {
            return { mrzText, error: null }
        }

        return { mrzText: null, error: 'MRZ non rilevata nell\'immagine' }
    } catch (err) {
        return { mrzText: null, error: `Errore OCR: ${err.message || 'errore sconosciuto'}` }
    } finally {
        if (worker) {
            try { await worker.terminate() } catch (_) { /* ignore */ }
        }
        canvases.forEach(disposeCanvas)
    }
}

/**
 * Create a Tesseract worker configured for MRZ OCR.
 * @returns {Promise<Tesseract.Worker>}
 */
async function createMRZWorker() {
    let worker
    try {
        worker = await Tesseract.createWorker('ocrb', 1, { errorHandler: () => {} })
    } catch {
        // Fallback to eng if ocrb not available
        worker = await Tesseract.createWorker('eng', 1, { errorHandler: () => {} })
    }

    await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
        tessedit_pageseg_mode: Tesseract.PSM ? Tesseract.PSM.SINGLE_BLOCK : '6'
    })

    return worker
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

        worker = await Tesseract.createWorker('ita', 1, { errorHandler: () => {} })
        await worker.setParameters({
            tessedit_pageseg_mode: Tesseract.PSM ? Tesseract.PSM.SINGLE_COLUMN : '4'
        })

        const { data } = await worker.recognize(canvas)
        const text = data.text || ''

        const address = extractAddressFromText(text)
        return { address: address || null, error: null }
    } catch (err) {
        return { address: null, error: `Errore OCR: ${err.message || 'errore sconosciuto'}` }
    } finally {
        if (worker) {
            try { await worker.terminate() } catch (_) { /* ignore */ }
        }
        disposeCanvas(canvas)
    }
}

/**
 * Extract nome and cognome from the Tessera Sanitaria front side.
 * The TS has clearly printed text with keywords "Cognome" and "Nome".
 * 
 * @param {File} imageFile - File immagine del fronte della TS
 * @returns {Promise<{cognome: string|null, nome: string|null, cf: string|null}>}
 */
export async function extractNameFromTSImage(imageFile) {
    let canvas = null
    let worker = null

    try {
        canvas = await preprocessImage(imageFile)

        worker = await Tesseract.createWorker('ita', 1, { errorHandler: () => {} })
        await worker.setParameters({
            tessedit_pageseg_mode: Tesseract.PSM ? Tesseract.PSM.SINGLE_BLOCK : '6'
        })

        const { data } = await worker.recognize(canvas)
        const text = data.text || ''
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)

        let cognome = null
        let nome = null
        let cf = null

        for (let i = 0; i < lines.length; i++) {
            const upper = lines[i].toUpperCase()

            // Look for "Cognome" keyword
            if (upper.includes('COGNOME') && !cognome) {
                const afterKeyword = lines[i].replace(/.*[Cc]ognome\s*/i, '').trim()
                if (afterKeyword.length >= 2 && /^[A-Z\s'-]+$/i.test(afterKeyword)) {
                    cognome = afterKeyword.toUpperCase()
                } else if (i + 1 < lines.length) {
                    const nextLine = lines[i + 1].trim()
                    if (nextLine.length >= 2 && /^[A-Z\s'-]+$/i.test(nextLine)) {
                        cognome = nextLine.toUpperCase()
                    }
                }
            }

            // Look for "Nome" keyword (but not "Cognome")
            if (upper.includes('NOME') && !upper.includes('COGNOME') && !nome) {
                const afterKeyword = lines[i].replace(/.*[Nn]ome\s*/i, '').trim()
                if (afterKeyword.length >= 2 && /^[A-Z\s'-]+$/i.test(afterKeyword)) {
                    nome = afterKeyword.toUpperCase()
                } else if (i + 1 < lines.length) {
                    const nextLine = lines[i + 1].trim()
                    if (nextLine.length >= 2 && /^[A-Z\s'-]+$/i.test(nextLine)) {
                        nome = nextLine.toUpperCase()
                    }
                }
            }

            // Also look for CF pattern (backup source)
            if (!cf) {
                const lineClean = lines[i].replace(/\s/g, '').toUpperCase()
                const cfMatch = lineClean.match(/[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]/)
                if (cfMatch) cf = cfMatch[0]
            }
        }

        // Clean up extracted names
        if (cognome) {
            cognome = cognome.replace(/[^A-Z\s'-]/g, '').replace(/\s+/g, ' ').trim()
            if (cognome.length < 2) cognome = null
        }
        if (nome) {
            nome = nome.replace(/[^A-Z\s'-]/g, '').replace(/\s+/g, ' ').trim()
            if (nome.length < 2) nome = null
        }

        return { cognome, nome, cf }
    } catch (err) {
        return { cognome: null, nome: null, cf: null }
    } finally {
        if (worker) {
            try { await worker.terminate() } catch (_) { /* ignore */ }
        }
        disposeCanvas(canvas)
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Multi-source document data extraction (main orchestrator)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Wraps an async step with a timeout to prevent indefinite blocking on mobile.
 * @param {Function} fn - Async function to execute
 * @param {number} timeoutMs - Max time in milliseconds (default 30s)
 * @returns {Promise}
 */
async function withStepTimeout(fn, timeoutMs = 30000) {
    return Promise.race([
        fn(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Step timeout')), timeoutMs))
    ])
}

/**
 * Multi-source document data extraction.
 * Orchestrates barcode, CF decode, MRZ OCR, TS OCR, and address extraction.
 * 
 * Priority order:
 * 1. CIE retro barcode → CF (most reliable)
 * 2. TS retro barcode → CF (fallback)
 * 3. CF decode → dataNascita, luogoNascita
 * 4. CIE retro MRZ → nome, cognome, dates, docnum (with K/L fix)
 * 5. TS fronte OCR → nome, cognome (supplementary)
 * 6. CIE fronte → indirizzo
 * 
 * @param {object} images - { cieRetro: File|null, cieFronte: File|null, tsFronte: File|null, tsRetro: File|null }
 * @returns {Promise<{fields: object, errors: string[]}>}
 */
export async function extractDocumentData(images) {
    const { cieRetro, cieFronte, tsFronte, tsRetro } = images
    const errors = []
    const fields = {
        cognome: null,
        nome: null,
        dataNascita: null,
        codiceFiscale: null,
        numeroDocumento: null,
        dataScadenza: null,
        indirizzo: null,
        luogoNascita: null
    }

    let cfDecoded = null

    // ═══ Step 1: CIE retro barcode → CF ═══
    if (cieRetro) {
        try {
            const cf = await withStepTimeout(() => extractCFFromBarcode(cieRetro), 15000)
            if (cf) {
                fields.codiceFiscale = cf
                cfDecoded = await decodeCF(cf)
                if (cfDecoded) {
                    fields.dataNascita = cfDecoded.dataNascita
                    fields.luogoNascita = cfDecoded.luogoNascita
                }
            }
        } catch (err) {
            errors.push('Timeout lettura barcode CIE')
        }
    }

    // ═══ Step 2: TS retro barcode → CF (fallback) ═══
    if (!fields.codiceFiscale && tsRetro) {
        try {
            const cf = await withStepTimeout(() => extractCFFromBarcode(tsRetro), 15000)
            if (cf) {
                fields.codiceFiscale = cf
                cfDecoded = await decodeCF(cf)
                if (cfDecoded) {
                    fields.dataNascita = cfDecoded.dataNascita
                    fields.luogoNascita = cfDecoded.luogoNascita
                }
            }
        } catch (err) {
            errors.push('Timeout lettura barcode TS')
        }
    }

    // ═══ Step 3: CIE retro MRZ → nome, cognome, dates, docnum ═══
    if (cieRetro) {
        try {
            const { mrzText, error: mrzError } = await withStepTimeout(() => extractMRZFromImage(cieRetro), 30000)

            if (mrzText) {
                // Import parseMRZ from mrz-parser for structured parsing
                const { parseMRZ } = await import('./mrz-parser.js')
                const { fields: mrzFields, errors: parseErrors } = parseMRZ(mrzText)

                if (mrzFields) {
                    fields.cognome = mrzFields.surname || null
                    fields.nome = mrzFields.givenNames || null
                    fields.numeroDocumento = mrzFields.documentNumber || null

                    if (mrzFields.expiryDate && mrzFields.expiryDate.length === 6) {
                        fields.dataScadenza = mrzFields.expiryDate
                    }

                    // Use MRZ dataNascita only if we don't already have it from CF decode
                    if (!fields.dataNascita && mrzFields.dateOfBirth && mrzFields.dateOfBirth.length === 6) {
                        fields.dataNascita = mrzFields.dateOfBirth
                    }

                    // CF from MRZ optionalData1 as fallback
                    if (!fields.codiceFiscale && mrzFields.optionalData1) {
                        const opt1 = mrzFields.optionalData1.replace(/\s/g, '').toUpperCase()
                        if (/^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test(opt1)) {
                            fields.codiceFiscale = opt1
                            if (!cfDecoded) {
                                cfDecoded = await decodeCF(opt1)
                                if (cfDecoded) {
                                    if (!fields.dataNascita) fields.dataNascita = cfDecoded.dataNascita
                                    if (!fields.luogoNascita) fields.luogoNascita = cfDecoded.luogoNascita
                                }
                            }
                        }
                    }
                }

                if (parseErrors && parseErrors.length > 0) {
                    errors.push(...parseErrors)
                }
            } else if (mrzError) {
                errors.push(mrzError)
            }
        } catch (err) {
            errors.push('Timeout o errore estrazione MRZ: ' + (err.message || 'sconosciuto'))
        }
    }

    // ═══ Step 4: TS fronte OCR → nome, cognome (supplementary) ═══
    if (tsFronte) {
        try {
            const tsResult = await withStepTimeout(() => extractNameFromTSImage(tsFronte), 30000)

            // Use TS names if MRZ didn't produce them or they're too short
            if (tsResult.cognome && (!fields.cognome || fields.cognome.length < 2)) {
                fields.cognome = tsResult.cognome
            } else if (tsResult.cognome && cfDecoded && fields.cognome) {
                // Validate both against CF consonants, prefer the better match
                const consonants = 'BCDFGHJKLMNPQRSTVWXYZ'
                const mrzCons = fields.cognome.toUpperCase().split('').filter(c => consonants.includes(c)).slice(0, 3).join('')
                const tsCons = tsResult.cognome.split('').filter(c => consonants.includes(c)).slice(0, 3).join('')
                const expected = cfDecoded.cognomeConsonants

                if (tsCons === expected && mrzCons !== expected) {
                    fields.cognome = tsResult.cognome
                }
            }

            if (tsResult.nome && (!fields.nome || fields.nome.length < 2)) {
                fields.nome = tsResult.nome
            } else if (tsResult.nome && cfDecoded && fields.nome) {
                const consonants = 'BCDFGHJKLMNPQRSTVWXYZ'
                const mrzCons = fields.nome.toUpperCase().split('').filter(c => consonants.includes(c)).slice(0, 3).join('')
                const tsCons = tsResult.nome.split('').filter(c => consonants.includes(c)).slice(0, 3).join('')
                const expected = cfDecoded.nomeConsonants

                if (tsCons === expected && mrzCons !== expected) {
                    fields.nome = tsResult.nome
                }
            }

            // CF from TS OCR as last resort
            if (!fields.codiceFiscale && tsResult.cf) {
                fields.codiceFiscale = tsResult.cf
                if (!cfDecoded) {
                    cfDecoded = await decodeCF(tsResult.cf)
                    if (cfDecoded) {
                        if (!fields.dataNascita) fields.dataNascita = cfDecoded.dataNascita
                        if (!fields.luogoNascita) fields.luogoNascita = cfDecoded.luogoNascita
                    }
                }
            }
        } catch (err) {
            errors.push('Timeout o errore OCR tessera sanitaria: ' + (err.message || 'sconosciuto'))
        }
    }

    // ═══ Step 5: CIE fronte → indirizzo ═══
    if (cieFronte) {
        try {
            const { address } = await withStepTimeout(() => extractAddressFromImage(cieFronte), 30000)
            if (address) {
                fields.indirizzo = address
            }
        } catch (err) {
            errors.push('Timeout o errore estrazione indirizzo: ' + (err.message || 'sconosciuto'))
        }
    }

    return { fields, errors }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Address extraction from OCR text
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Estrae un indirizzo dal testo OCR della zona VIZ della carta.
 * Handles Italian address patterns including Via, Piazza, Vicolo, etc.
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

    // Pattern 1: keyword "RESIDENZA" / "RESIDENCE" → take next line(s)
    for (let i = 0; i < lines.length; i++) {
        const upperLine = lines[i].toUpperCase()
        if (upperLine.includes('RESIDENZA') || upperLine.includes('RESIDENCE') || upperLine.includes('RESIDEN')) {
            const afterKeyword = lines[i].replace(/residenz[ae]/i, '').replace(/[:\-]/g, '').trim()
            if (afterKeyword.length > 5) {
                return afterKeyword
            }
            if (i + 1 < lines.length && lines[i + 1].length > 5) {
                let address = lines[i + 1]
                if (i + 2 < lines.length) {
                    const nextNext = lines[i + 2]
                    if (/^\d{5}/.test(nextNext) || /\([A-Z]{2}\)/.test(nextNext)) {
                        address += ' ' + nextNext
                    }
                }
                return address
            }
        }
    }

    // Pattern 2: "INDIRIZZO" keyword
    for (let i = 0; i < lines.length; i++) {
        const upperLine = lines[i].toUpperCase()
        if (upperLine.includes('INDIRIZZO')) {
            if (i + 1 < lines.length && lines[i + 1].length > 3) {
                let address = lines[i + 1]
                if (i + 2 < lines.length) {
                    const nextNext = lines[i + 2]
                    if (/^\d{5}/.test(nextNext) || /\([A-Z]{2}\)/.test(nextNext)) {
                        address += ' ' + nextNext
                    }
                }
                return address
            }
        }
    }

    // Pattern 3: Italian address type prefixes
    const addressPrefixes = /^(VIA|V\.|PIAZZA|P\.ZZA|P\.ZA|PIAZZALE|P\.LE|CORSO|C\.SO|VIALE|V\.LE|LARGO|L\.GO|LOCALITA'|LOCALITA|LOC\.|LOC |CONTRADA|C\.DA|FRAZIONE|FRAZ\.|VICOLO|VIC\.|STRADA|STR\.|BORGATA|LUNGOMARE|L\.MARE|SALITA|TRAVERSA|TRAV\.)\s+/i

    for (let i = 0; i < lines.length; i++) {
        if (addressPrefixes.test(lines[i])) {
            let address = lines[i]
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1]
                if (/^\d{5}/.test(nextLine) || /^[A-Z]{2,}/.test(nextLine.toUpperCase()) || /\d/.test(nextLine)) {
                    address += ' ' + nextLine
                }
            }
            return address
        }
    }

    // Pattern 4: full address format "indirizzo, CAP Città (PROV)"
    const fullAddressPattern = /(.+,\s*\d{5}\s+[A-Za-z\s]+(\([A-Z]{2}\))?)/
    for (const line of lines) {
        const match = line.match(fullAddressPattern)
        if (match) {
            return match[1].trim()
        }
    }

    // Pattern 5: CAP (5 digits) followed by city name
    for (let i = 0; i < lines.length; i++) {
        const capMatch = lines[i].match(/(\d{5})\s+([A-Za-z\s]+)/)
        if (capMatch) {
            if (i > 0 && lines[i - 1].length > 3) {
                return lines[i - 1] + ' ' + lines[i]
            }
            return lines[i]
        }
    }

    // Pattern 6: province code in parentheses (TN), (VR), etc.
    for (let i = 0; i < lines.length; i++) {
        if (/\([A-Z]{2}\)/.test(lines[i])) {
            const upperLine = lines[i].toUpperCase()
            const excludeKeywords = ['NASCITA', 'BIRTH', 'ISSUING', 'EMISSIONE', 'NATIONAL']
            if (excludeKeywords.some(kw => upperLine.includes(kw))) continue
            if (i > 0 && lines[i - 1].length > 3) {
                const prevUpper = lines[i - 1].toUpperCase()
                if (!excludeKeywords.some(kw => prevUpper.includes(kw))) {
                    return lines[i - 1] + ' ' + lines[i]
                }
            }
            return lines[i]
        }
    }

    return null
}
