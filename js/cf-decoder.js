/**
 * Italian Codice Fiscale decoder.
 * Extracts: data nascita, sesso, luogo nascita (via codice catastale lookup).
 * 
 * The codici catastali JSON maps 4-char municipal codes to city names.
 * File is loaded lazily on first use from frontend/data/codici-catastali.json.
 */

// Lazy-loaded codici catastali lookup
let codiciCatastali = null

/**
 * Load the codici catastali lookup table.
 * Fetched once and cached in memory.
 * @returns {Promise<object>} Map of codice → comune name
 */
async function loadCodici() {
    if (codiciCatastali) return codiciCatastali

    try {
        // Use relative path from the page location. Since pages are in /pages/,
        // we go up one level to reach /data/
        const resp = await fetch(new URL('../data/codici-catastali.json', import.meta.url))
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        codiciCatastali = await resp.json()
    } catch {
        // Fallback: try alternative path (when imported from root-level pages)
        try {
            const resp = await fetch('/data/codici-catastali.json')
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
            codiciCatastali = await resp.json()
        } catch {
            codiciCatastali = {}
        }
    }

    return codiciCatastali
}

/**
 * Month letter mapping in Italian Codice Fiscale.
 * Each month is encoded as a specific letter.
 */
const CF_MONTH_MAP = {
    A: '01', B: '02', C: '03', D: '04', E: '05',
    H: '06', L: '07', M: '08', P: '09', R: '10',
    S: '11', T: '12'
}

/**
 * Decodes structured data from an Italian Codice Fiscale.
 * 
 * CF structure: XXXYYY99A99Z999X
 * - Pos 0-2: surname consonants
 * - Pos 3-5: given name consonants
 * - Pos 6-7: birth year (YY)
 * - Pos 8: month letter
 * - Pos 9-10: day (female: day + 40)
 * - Pos 11-14: codice catastale (municipal code)
 * - Pos 15: check character
 * 
 * @param {string} cf - 16-char CF string
 * @returns {Promise<object|null>} Decoded data or null if invalid
 */
export async function decodeCF(cf) {
    if (!cf || cf.length !== 16) return null

    const cfUpper = cf.toUpperCase()

    const cognomeConsonants = cfUpper.substring(0, 3)
    const nomeConsonants = cfUpper.substring(3, 6)
    const annoNascita = cfUpper.substring(6, 8)
    const meseCodice = cfUpper.substring(8, 9)
    const giornoRaw = parseInt(cfUpper.substring(9, 11), 10)

    const mese = CF_MONTH_MAP[meseCodice] || null
    if (!mese) return null

    // Day > 40 means female (day = actual day + 40)
    const sesso = giornoRaw > 40 ? 'F' : 'M'
    const giorno = sesso === 'F'
        ? String(giornoRaw - 40).padStart(2, '0')
        : String(giornoRaw).padStart(2, '0')

    // Validate day is reasonable
    const dayNum = parseInt(giorno, 10)
    if (dayNum < 1 || dayNum > 31) return null

    // Century heuristic: YY > 30 → 19XX, else 20XX
    const yearNum = parseInt(annoNascita, 10)
    const century = yearNum > 30 ? '19' : '20'
    const dataNascita = `${century}${annoNascita}-${mese}-${giorno}`

    // Look up birthplace from codice catastale
    const codiceCatastale = cfUpper.substring(11, 15)
    const codici = await loadCodici()
    const luogoNascita = codici[codiceCatastale] || null

    return {
        cognomeConsonants,
        nomeConsonants,
        dataNascita,       // YYYY-MM-DD format
        sesso,             // 'M' or 'F'
        luogoNascita,      // Comune name or null
        codiceCatastale,
        annoNascita: `${century}${annoNascita}`,
        meseNascita: mese,
        giornoNascita: giorno
    }
}

/**
 * Validates the structural format of an Italian Codice Fiscale.
 * Does NOT check the check digit — only verifies the pattern is plausible.
 * 
 * @param {string} cf - String to validate
 * @returns {boolean} True if structurally valid
 */
export function isValidCFStructure(cf) {
    if (!cf || cf.length !== 16) return false

    const cfUpper = cf.toUpperCase()

    // Basic pattern check
    if (!/^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test(cfUpper)) return false

    // Month letter must be valid
    const validMonthLetters = 'ABCDEHLMPRST'
    if (!validMonthLetters.includes(cfUpper[8])) return false

    // Day must be valid (1-31 or 41-71)
    const day = parseInt(cfUpper.substring(9, 11), 10)
    if (!((day >= 1 && day <= 31) || (day >= 41 && day <= 71))) return false

    return true
}
