/**
 * MRZ Parser — Parsing e formattazione MRZ formato TD1 (ICAO 9303)
 *
 * Formato TD1: 3 righe × 30 caratteri = 90 caratteri totali
 * Caratteri ammessi: A-Z, 0-9, <
 *
 * Layout TD1:
 * Riga 1: [DocCode 2][State 3][DocNum 9][Check 1][Optional1 15]
 * Riga 2: [DOB 6][Check 1][Sex 1][Expiry 6][Check 1][Nationality 3][Optional2 11][CompositeCheck 1]
 * Riga 3: [Name 30] — formato: COGNOME<<NOMI<<<...
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

/** Caratteri validi in una stringa MRZ */
const VALID_CHARS_REGEX = /^[A-Z0-9<]+$/

/** Lunghezza totale MRZ TD1 (3 × 30) */
const MRZ_TOTAL_LENGTH = 90

/** Lunghezza singola riga */
const LINE_LENGTH = 30

/**
 * Calcola il valore numerico di un singolo carattere MRZ secondo ICAO 9303.
 * 0-9 → 0-9, A-Z → 10-35, < → 0
 * @param {string} char
 * @returns {number}
 */
function charValue(char) {
  if (char === '<') return 0
  const code = char.charCodeAt(0)
  // 0-9
  if (code >= 48 && code <= 57) return code - 48
  // A-Z
  if (code >= 65 && code <= 90) return code - 55
  return 0
}

/**
 * Calcola la cifra di controllo ICAO 9303 per una stringa.
 * Pesi ciclici: 7, 3, 1
 * Risultato: somma(valore × peso) mod 10
 *
 * @param {string} input - Stringa di caratteri MRZ
 * @returns {string} Singolo carattere cifra (0-9)
 */
export function computeCheckDigit(input) {
  const weights = [7, 3, 1]
  let sum = 0
  for (let i = 0; i < input.length; i++) {
    sum += charValue(input[i]) * weights[i % 3]
  }
  return String(sum % 10)
}

/**
 * Converte i caratteri filler '<' in spazi e rimuove gli spazi finali.
 * @param {string} raw
 * @returns {string}
 */
function cleanField(raw) {
  return raw.replace(/</g, ' ').trim()
}

/**
 * Estrae cognome e nomi dalla riga 3 della MRZ.
 * Formato: COGNOME<<NOME1<NOME2<...<<<
 * @param {string} nameLine - Riga 3 (30 caratteri)
 * @returns {{ surname: string, givenNames: string }}
 */
function parseNameLine(nameLine) {
  const parts = nameLine.split('<<')
  const surname = cleanField(parts[0] || '')
  // I nomi sono separati da singolo '<'
  const givenNamesRaw = parts.slice(1).join('<<')
  const givenNames = cleanField(givenNamesRaw)
  return { surname, givenNames }
}

/**
 * Normalizza l'input MRZ in un array di 3 righe da 30 caratteri.
 * @param {string|string[]} mrzInput
 * @returns {{ lines: string[]|null, errors: string[] }}
 */
function normalizeInput(mrzInput) {
  const errors = []

  let raw
  if (Array.isArray(mrzInput)) {
    if (mrzInput.length !== 3) {
      errors.push('Input MRZ deve contenere 3 righe')
      return { lines: null, errors }
    }
    raw = mrzInput.join('')
  } else if (typeof mrzInput === 'string') {
    raw = mrzInput
  } else {
    errors.push('Input MRZ deve essere una stringa o un array di 3 stringhe')
    return { lines: null, errors }
  }

  // Rimuovi eventuali newline
  raw = raw.replace(/[\r\n]/g, '')

  // Converti in uppercase
  raw = raw.toUpperCase()

  if (raw.length !== MRZ_TOTAL_LENGTH) {
    errors.push(`Lunghezza MRZ non valida: ${raw.length} caratteri (attesi ${MRZ_TOTAL_LENGTH})`)
    return { lines: null, errors }
  }

  if (!VALID_CHARS_REGEX.test(raw)) {
    errors.push('Caratteri non ammessi nella stringa MRZ (ammessi solo A-Z, 0-9, <)')
    return { lines: null, errors }
  }

  const lines = [
    raw.substring(0, LINE_LENGTH),
    raw.substring(LINE_LENGTH, LINE_LENGTH * 2),
    raw.substring(LINE_LENGTH * 2, LINE_LENGTH * 3)
  ]

  return { lines, errors }
}

/**
 * Parsing completo di una stringa MRZ in formato TD1.
 *
 * @param {string|string[]} mrzInput - Stringa di 90 caratteri o array di 3 stringhe da 30
 * @returns {{ fields: object|null, errors: string[] }}
 */
export function parseMRZ(mrzInput) {
  const { lines, errors } = normalizeInput(mrzInput)
  if (!lines) return { fields: null, errors }

  const [line1, line2, line3] = lines

  // Estrazione campi da riga 1
  const documentCode = line1.substring(0, 2)
  const issuingState = line1.substring(2, 5)
  const documentNumber = line1.substring(5, 14)
  const documentNumberCheckDigit = line1.substring(14, 15)
  const optionalData1 = line1.substring(15, 30)

  // Estrazione campi da riga 2
  const dateOfBirth = line2.substring(0, 6)
  const dateOfBirthCheckDigit = line2.substring(6, 7)
  const sex = line2.substring(7, 8)
  const expiryDate = line2.substring(8, 14)
  const expiryDateCheckDigit = line2.substring(14, 15)
  const nationality = line2.substring(15, 18)
  const optionalData2 = line2.substring(18, 29)
  const compositeCheckDigit = line2.substring(29, 30)

  // Estrazione nomi da riga 3
  const { surname, givenNames } = parseNameLine(line3)

  // Verifica cifre di controllo
  const checkErrors = []

  const expectedDocCheck = computeCheckDigit(documentNumber)
  if (documentNumberCheckDigit !== expectedDocCheck) {
    checkErrors.push(`Check digit numero documento non valido (atteso ${expectedDocCheck}, trovato ${documentNumberCheckDigit})`)
  }

  const expectedDobCheck = computeCheckDigit(dateOfBirth)
  if (dateOfBirthCheckDigit !== expectedDobCheck) {
    checkErrors.push(`Check digit data di nascita non valido (atteso ${expectedDobCheck}, trovato ${dateOfBirthCheckDigit})`)
  }

  const expectedExpiryCheck = computeCheckDigit(expiryDate)
  if (expiryDateCheckDigit !== expectedExpiryCheck) {
    checkErrors.push(`Check digit data di scadenza non valido (atteso ${expectedExpiryCheck}, trovato ${expiryDateCheckDigit})`)
  }

  // Composite: doc number + check + optional1 + DOB + check + expiry + check + optional2
  const compositeInput = documentNumber + documentNumberCheckDigit + optionalData1 +
    dateOfBirth + dateOfBirthCheckDigit + expiryDate + expiryDateCheckDigit + optionalData2
  const expectedCompositeCheck = computeCheckDigit(compositeInput)
  if (compositeCheckDigit !== expectedCompositeCheck) {
    checkErrors.push(`Check digit composito non valido (atteso ${expectedCompositeCheck}, trovato ${compositeCheckDigit})`)
  }

  const fields = {
    documentCode: cleanField(documentCode),
    issuingState: cleanField(issuingState),
    documentNumber: cleanField(documentNumber),
    documentNumberCheckDigit,
    optionalData1: cleanField(optionalData1),
    dateOfBirth,
    dateOfBirthCheckDigit,
    sex: sex === '<' ? '' : sex,
    expiryDate,
    expiryDateCheckDigit,
    nationality: cleanField(nationality),
    optionalData2: cleanField(optionalData2),
    compositeCheckDigit,
    surname,
    givenNames
  }

  return { fields, errors: checkErrors }
}

/**
 * Formatta un oggetto campi MRZ in una stringa MRZ TD1 valida.
 * Ricalcola tutte le cifre di controllo.
 *
 * @param {object} fieldsObj - Oggetto con i campi MRZ
 * @returns {string[]} Array di 3 stringhe da 30 caratteri
 */
export function formatMRZ(fieldsObj) {
  // Helper: converti un campo testo in formato MRZ (spazi → <, uppercase, padding)
  const toMRZ = (str, len) => {
    const cleaned = (str || '').toUpperCase().replace(/ /g, '<')
    return cleaned.padEnd(len, '<').substring(0, len)
  }

  // Riga 1
  const docCode = toMRZ(fieldsObj.documentCode, 2)
  const state = toMRZ(fieldsObj.issuingState, 3)
  const docNum = toMRZ(fieldsObj.documentNumber, 9)
  const docNumCheck = computeCheckDigit(docNum)
  const opt1 = toMRZ(fieldsObj.optionalData1, 15)

  const line1 = docCode + state + docNum + docNumCheck + opt1

  // Riga 2
  const dob = toMRZ(fieldsObj.dateOfBirth, 6)
  const dobCheck = computeCheckDigit(dob)
  const sex = fieldsObj.sex ? fieldsObj.sex.toUpperCase() : '<'
  const expiry = toMRZ(fieldsObj.expiryDate, 6)
  const expiryCheck = computeCheckDigit(expiry)
  const nat = toMRZ(fieldsObj.nationality, 3)
  const opt2 = toMRZ(fieldsObj.optionalData2, 11)

  // Composite check: docNum + docNumCheck + opt1 + dob + dobCheck + expiry + expiryCheck + opt2
  const compositeInput = docNum + docNumCheck + opt1 + dob + dobCheck + expiry + expiryCheck + opt2
  const compositeCheck = computeCheckDigit(compositeInput)

  const line2 = dob + dobCheck + sex + expiry + expiryCheck + nat + opt2 + compositeCheck

  // Riga 3: COGNOME<<NOMI<<< (padded a 30)
  const surnameRaw = (fieldsObj.surname || '').toUpperCase().replace(/ /g, '<')
  const givenNamesRaw = (fieldsObj.givenNames || '').toUpperCase().replace(/ /g, '<')
  const namePart = surnameRaw + '<<' + givenNamesRaw
  const line3 = namePart.padEnd(LINE_LENGTH, '<').substring(0, LINE_LENGTH)

  return [line1, line2, line3]
}

/**
 * Valida le cifre di controllo di una stringa MRZ senza parsing completo.
 *
 * @param {string|string[]} mrzInput - Stringa MRZ o array di 3 righe
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCheckDigits(mrzInput) {
  const { lines, errors } = normalizeInput(mrzInput)
  if (!lines) return { valid: false, errors }

  const [line1, line2] = lines
  const checkErrors = []

  // Check digit numero documento
  const documentNumber = line1.substring(5, 14)
  const documentNumberCheckDigit = line1.substring(14, 15)
  const expectedDocCheck = computeCheckDigit(documentNumber)
  if (documentNumberCheckDigit !== expectedDocCheck) {
    checkErrors.push(`Check digit numero documento non valido (atteso ${expectedDocCheck}, trovato ${documentNumberCheckDigit})`)
  }

  // Check digit data di nascita
  const dateOfBirth = line2.substring(0, 6)
  const dateOfBirthCheckDigit = line2.substring(6, 7)
  const expectedDobCheck = computeCheckDigit(dateOfBirth)
  if (dateOfBirthCheckDigit !== expectedDobCheck) {
    checkErrors.push(`Check digit data di nascita non valido (atteso ${expectedDobCheck}, trovato ${dateOfBirthCheckDigit})`)
  }

  // Check digit data di scadenza
  const expiryDate = line2.substring(8, 14)
  const expiryDateCheckDigit = line2.substring(14, 15)
  const expectedExpiryCheck = computeCheckDigit(expiryDate)
  if (expiryDateCheckDigit !== expectedExpiryCheck) {
    checkErrors.push(`Check digit data di scadenza non valido (atteso ${expectedExpiryCheck}, trovato ${expiryDateCheckDigit})`)
  }

  // Check digit composito
  const optionalData1 = line1.substring(15, 30)
  const optionalData2 = line2.substring(18, 29)
  const compositeCheckDigit = line2.substring(29, 30)
  const compositeInput = documentNumber + documentNumberCheckDigit + optionalData1 +
    dateOfBirth + dateOfBirthCheckDigit + expiryDate + expiryDateCheckDigit + optionalData2
  const expectedCompositeCheck = computeCheckDigit(compositeInput)
  if (compositeCheckDigit !== expectedCompositeCheck) {
    checkErrors.push(`Check digit composito non valido (atteso ${expectedCompositeCheck}, trovato ${compositeCheckDigit})`)
  }

  return { valid: checkErrors.length === 0, errors: checkErrors }
}
