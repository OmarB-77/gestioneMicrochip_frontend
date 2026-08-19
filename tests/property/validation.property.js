import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { validateChipNumber, validateCodiceFiscale, validateDate } from '../../js/validation.js'

const PBT_CONFIG = { numRuns: 100 }

// Helper: calcola il carattere di controllo del codice fiscale italiano
const ODD_TABLE = {
  '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
  'A': 1, 'B': 0, 'C': 5, 'D': 7, 'E': 9, 'F': 13, 'G': 15, 'H': 17, 'I': 19, 'J': 21,
  'K': 2, 'L': 4, 'M': 18, 'N': 20, 'O': 11, 'P': 3, 'Q': 6, 'R': 8, 'S': 12, 'T': 14,
  'U': 16, 'V': 10, 'W': 22, 'X': 25, 'Y': 24, 'Z': 23
}
const EVEN_TABLE = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5, 'G': 6, 'H': 7, 'I': 8, 'J': 9,
  'K': 10, 'L': 11, 'M': 12, 'N': 13, 'O': 14, 'P': 15, 'Q': 16, 'R': 17, 'S': 18, 'T': 19,
  'U': 20, 'V': 21, 'W': 22, 'X': 23, 'Y': 24, 'Z': 25
}
const CHECK_LETTER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function computeCFCheckChar(cf15) {
  let sum = 0
  for (let i = 0; i < 15; i++) {
    const char = cf15[i]
    if ((i + 1) % 2 === 1) {
      sum += ODD_TABLE[char]
    } else {
      sum += EVEN_TABLE[char]
    }
  }
  return CHECK_LETTER[sum % 26]
}

// Arbitrary: stringa di esattamente 15 cifre
const digitCharArb = fc.constantFrom(...'0123456789'.split(''))
const validChipNumberArb = fc.string({ unit: digitCharArb, minLength: 15, maxLength: 15 })

// Arbitrary: stringa NON di 15 cifre (lunghezza diversa da 15, o contiene non-cifre)
const invalidChipNumberArb = fc.oneof(
  // Lunghezza sbagliata (solo cifre ma non 15)
  fc.string({ unit: digitCharArb, minLength: 1, maxLength: 14 }),
  fc.string({ unit: digitCharArb, minLength: 16, maxLength: 30 }),
  // Lunghezza 15 ma con almeno un carattere non-cifra
  fc.tuple(
    fc.nat({ max: 14 }),
    fc.string({ unit: digitCharArb, minLength: 15, maxLength: 15 }),
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*()-_ '.split(''))
  ).map(([pos, digits, nonDigit]) => digits.substring(0, pos) + nonDigit + digits.substring(pos + 1))
)

// Arbitrary: primi 15 caratteri alfanumerici uppercase per CF
const cfAlphanumCharArb = fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split(''))
const cf15Arb = fc.string({ unit: cfAlphanumCharArb, minLength: 15, maxLength: 15 })

// Arbitrary: CF valido (15 chars + check digit corretto)
const validCFArb = cf15Arb.map(cf15 => {
  const checkChar = computeCFCheckChar(cf15)
  return cf15 + checkChar
})

// Arbitrary: CF con check digit ERRATO
const invalidCFCheckDigitArb = cf15Arb.chain(cf15 => {
  const correctCheck = computeCFCheckChar(cf15)
  // Scegli una lettera diversa da quella corretta
  const wrongLetters = CHECK_LETTER.split('').filter(l => l !== correctCheck)
  return fc.constantFrom(...wrongLetters).map(wrongCheck => cf15 + wrongCheck)
})

// Arbitrary: data futura in formato DD/MM/YYYY
const futureDateArb = fc.integer({ min: 1, max: 3650 }).map(daysAhead => {
  const future = new Date()
  future.setDate(future.getDate() + daysAhead)
  const day = String(future.getDate()).padStart(2, '0')
  const month = String(future.getMonth() + 1).padStart(2, '0')
  const year = future.getFullYear()
  return `${day}/${month}/${year}`
})

// Arbitrary: data passata o odierna in formato DD/MM/YYYY (da oggi fino a 30 anni fa)
const pastOrTodayDateArb = fc.integer({ min: 0, max: 10950 }).map(daysBack => {
  const past = new Date()
  past.setDate(past.getDate() - daysBack)
  const day = String(past.getDate()).padStart(2, '0')
  const month = String(past.getMonth() + 1).padStart(2, '0')
  const year = past.getFullYear()
  return `${day}/${month}/${year}`
})

// Feature: gestione-microchip, Property 5: Validazione numero chip
// **Validates: Requirements 3.2**
describe('Property 5: Validazione numero chip', () => {
  it('accetta qualsiasi stringa di esattamente 15 cifre', () => {
    fc.assert(
      fc.property(validChipNumberArb, (chipNum) => {
        const result = validateChipNumber(chipNum)
        expect(result.valid).toBe(true)
        expect(result.error).toBeNull()
      }),
      PBT_CONFIG
    )
  })

  it('rifiuta qualsiasi stringa che NON è di 15 cifre', () => {
    fc.assert(
      fc.property(invalidChipNumberArb, (chipNum) => {
        const result = validateChipNumber(chipNum)
        expect(result.valid).toBe(false)
        expect(result.error).toBeTruthy()
      }),
      PBT_CONFIG
    )
  })
})

// Feature: gestione-microchip, Property 6: Validazione codice fiscale
// **Validates: Requirements 5.3, 16.2**
describe('Property 6: Validazione codice fiscale', () => {
  it('accetta qualsiasi CF di 16 caratteri alfanumerici con check digit corretto', () => {
    fc.assert(
      fc.property(validCFArb, (cf) => {
        const result = validateCodiceFiscale(cf)
        expect(result.valid).toBe(true)
        expect(result.error).toBeNull()
      }),
      PBT_CONFIG
    )
  })

  it('rifiuta qualsiasi CF con check digit errato', () => {
    fc.assert(
      fc.property(invalidCFCheckDigitArb, (cf) => {
        const result = validateCodiceFiscale(cf)
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Carattere di controllo non corretto')
      }),
      PBT_CONFIG
    )
  })
})

// Feature: gestione-microchip, Property 8: Validazione date non future
// **Validates: Requirements 3.2, 5.3, 16.2, 16.4**
describe('Property 8: Validazione date non future', () => {
  it('rifiuta qualsiasi data futura quando allowFuture=false', () => {
    fc.assert(
      fc.property(futureDateArb, (dateStr) => {
        const result = validateDate(dateStr, { allowFuture: false })
        expect(result.valid).toBe(false)
        expect(result.error).toContain('futuro')
      }),
      PBT_CONFIG
    )
  })

  it('accetta qualsiasi data passata o odierna in formato valido', () => {
    fc.assert(
      fc.property(pastOrTodayDateArb, (dateStr) => {
        const result = validateDate(dateStr, { allowFuture: false })
        expect(result.valid).toBe(true)
        expect(result.error).toBeNull()
      }),
      PBT_CONFIG
    )
  })
})
