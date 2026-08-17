/**
 * Modulo di validazione - Gestione Microchip
 * 
 * Funzioni di validazione per: numero chip, codice fiscale, date, form generici.
 */

// Tabella conversione posizioni dispari (1-indexed: 1, 3, 5, ..., 15) per il calcolo del carattere di controllo CF
const ODD_TABLE = {
  '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
  'A': 1, 'B': 0, 'C': 5, 'D': 7, 'E': 9, 'F': 13, 'G': 15, 'H': 17, 'I': 19, 'J': 21,
  'K': 2, 'L': 4, 'M': 18, 'N': 20, 'O': 11, 'P': 3, 'Q': 6, 'R': 8, 'S': 12, 'T': 14,
  'U': 16, 'V': 10, 'W': 22, 'X': 25, 'Y': 24, 'Z': 23
}

// Tabella conversione posizioni pari (1-indexed: 2, 4, 6, ..., 14) per il calcolo del carattere di controllo CF
const EVEN_TABLE = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5, 'G': 6, 'H': 7, 'I': 8, 'J': 9,
  'K': 10, 'L': 11, 'M': 12, 'N': 13, 'O': 14, 'P': 15, 'Q': 16, 'R': 17, 'S': 18, 'T': 19,
  'U': 20, 'V': 21, 'W': 22, 'X': 23, 'Y': 24, 'Z': 25
}

// Lettera di controllo: risultato mod 26 → lettera
const CHECK_LETTER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * Valida un numero di microchip.
 * Deve essere esattamente 15 cifre numeriche.
 * 
 * @param {string} num - Numero chip da validare
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateChipNumber(num) {
  if (num == null || num === '') {
    return { valid: false, error: 'Il numero chip è obbligatorio' }
  }

  const str = String(num).trim()

  if (!/^\d{15}$/.test(str)) {
    return { valid: false, error: 'Numero chip non valido: deve essere di 15 cifre numeriche' }
  }

  return { valid: true, error: null }
}

/**
 * Calcola il carattere di controllo del codice fiscale italiano.
 * 
 * @param {string} cf15 - I primi 15 caratteri del CF (uppercase)
 * @returns {string} - Lettera di controllo attesa
 */
function computeCFCheckChar(cf15) {
  let sum = 0

  for (let i = 0; i < 15; i++) {
    const char = cf15[i]
    // Posizioni 1-indexed: i=0 → posizione 1 (dispari), i=1 → posizione 2 (pari), ...
    if ((i + 1) % 2 === 1) {
      // Posizione dispari
      sum += ODD_TABLE[char]
    } else {
      // Posizione pari
      sum += EVEN_TABLE[char]
    }
  }

  return CHECK_LETTER[sum % 26]
}

/**
 * Valida un codice fiscale italiano.
 * Deve essere 16 caratteri alfanumerici con carattere di controllo corretto.
 * 
 * @param {string} cf - Codice fiscale da validare
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateCodiceFiscale(cf) {
  if (cf == null || cf === '') {
    return { valid: false, error: 'Il codice fiscale è obbligatorio' }
  }

  const str = String(cf).trim().toUpperCase()

  if (str.length !== 16) {
    return { valid: false, error: 'Deve essere di 16 caratteri' }
  }

  if (!/^[A-Z0-9]{16}$/.test(str)) {
    return { valid: false, error: 'Deve contenere solo caratteri alfanumerici' }
  }

  // Verifica carattere di controllo (posizione 16, index 15)
  const expectedCheck = computeCFCheckChar(str.substring(0, 15))
  if (str[15] !== expectedCheck) {
    return { valid: false, error: 'Carattere di controllo non corretto' }
  }

  return { valid: true, error: null }
}

/**
 * Parsa una stringa data in formato DD/MM/YYYY e restituisce un oggetto Date.
 * Verifica che la data sia effettivamente valida (es. non 31/02/2024).
 * 
 * @param {string} dateStr - Stringa data in formato DD/MM/YYYY
 * @returns {Date|null} - Oggetto Date se valido, null altrimenti
 */
function parseDateString(dateStr) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateStr)
  if (!match) return null

  const day = parseInt(match[1], 10)
  const month = parseInt(match[2], 10)
  const year = parseInt(match[3], 10)

  // Verifica range base
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  // Crea la data e verifica che sia coerente (es. il 31 febbraio genererebbe una data diversa)
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

/**
 * Valida una data.
 * 
 * @param {string} dateStr - Stringa data in formato DD/MM/YYYY
 * @param {object} [options] - Opzioni di validazione
 * @param {boolean} [options.allowFuture=false] - Se true, ammette date future
 * @param {Date|null} [options.minDate=null] - Data minima accettabile
 * @returns {{ valid: boolean, error: string|null, date: Date|null }}
 */
export function validateDate(dateStr, options = {}) {
  const { allowFuture = false, minDate = null } = options

  if (dateStr == null || dateStr === '') {
    return { valid: false, error: 'La data è obbligatoria', date: null }
  }

  const str = String(dateStr).trim()

  const date = parseDateString(str)
  if (!date) {
    return { valid: false, error: 'Formato data non valido. Usa il formato GG/MM/AAAA', date: null }
  }

  // Verifica che la data non sia futura (se non consentito)
  if (!allowFuture) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (date > today) {
      return { valid: false, error: 'La data non può essere nel futuro', date: null }
    }
  }

  // Verifica data minima
  if (minDate != null) {
    const min = new Date(minDate)
    min.setHours(0, 0, 0, 0)
    if (date < min) {
      return { valid: false, error: `La data non può essere anteriore al ${formatDate(min)}`, date: null }
    }
  }

  return { valid: true, error: null, date }
}

/**
 * Formatta un oggetto Date in formato DD/MM/YYYY.
 * 
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

/**
 * Valida un intero form in base alle regole fornite.
 * Esegue tutti i validatori e raccoglie tutti gli errori simultaneamente.
 * 
 * @param {HTMLFormElement} formElement - L'elemento form da validare
 * @param {Array<{fieldId: string, validator: function, options?: object}>} rules - Regole di validazione
 * @returns {{ valid: boolean, errors: Array<{field: string, message: string}> }}
 */
export function validateForm(formElement, rules) {
  const errors = []

  for (const rule of rules) {
    const { fieldId, validator, options } = rule
    const field = formElement.querySelector(`#${fieldId}`) || formElement.querySelector(`[name="${fieldId}"]`)

    const value = field ? (field.type === 'checkbox' ? field.checked : field.value) : ''

    const result = validator(value, options)

    if (!result.valid) {
      errors.push({ field: fieldId, message: result.error })
    }
  }

  return { valid: errors.length === 0, errors }
}
