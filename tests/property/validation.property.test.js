import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { validateChipNumber, validateCodiceFiscale, validateDate } from '../../js/validation.js'

const PBT_CONFIG = { numRuns: 100 }

// --- Helpers per il calcolo del carattere di controllo CF ---

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

// --- Generators ---

const digitChars = '0123456789'.split('')
const alphanumChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')

// Feature: gestione-microchip, Property 5: Validazione numero chip
// **Validates: Requirements 3.2**
describe('Property 5: Chip number valid iff 15 digits', () => {
  it('any 15-digit string is accepted as valid chip number', () => {
    fc.assert(
      fc.property(
        fc.string({ unit: fc.constantFrom(...digitChars), minLength: 15, maxLength: 15 }),
        (chipNum) => {
          const result = validateChipNumber(chipNum)
          expect(result.valid).toBe(true)
          expect(result.error).toBeNull()
        }
      ),
      PBT_CONFIG
    )
  })

  it('strings with length != 15 are rejected', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string({ unit: fc.constantFrom(...digitChars), minLength: 1, maxLength: 14 }),
          fc.string({ unit: fc.constantFrom(...digitChars), minLength: 16, maxLength: 30 })
        ),
        (chipNum) => {
          const result = validateChipNumber(chipNum)
          expect(result.valid).toBe(false)
          expect(result.error).toBeTruthy()
        }
      ),
      PBT_CONFIG
    )
  })

  it('15-char strings containing non-digits are rejected', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.nat({ max: 14 }),
          fc.string({ unit: fc.constantFrom(...digitChars), minLength: 15, maxLength: 15 }),
          fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*'.split(''))
        ).map(([pos, digits, nonDigit]) => digits.substring(0, pos) + nonDigit + digits.substring(pos + 1)),
        (chipNum) => {
          const result = validateChipNumber(chipNum)
          expect(result.valid).toBe(false)
          expect(result.error).toBeTruthy()
        }
      ),
      PBT_CONFIG
    )
  })
})

// Feature: gestione-microchip, Property 6: Validazione codice fiscale
// **Validates: Requirements 5.3, 16.2**
describe('Property 6: Codice fiscale with wrong check char is rejected', () => {
  it('CF with correct check char is accepted', () => {
    fc.assert(
      fc.property(
        fc.string({ unit: fc.constantFrom(...alphanumChars), minLength: 15, maxLength: 15 }).map(cf15 => {
          const checkChar = computeCFCheckChar(cf15)
          return cf15 + checkChar
        }),
        (cf) => {
          const result = validateCodiceFiscale(cf)
          expect(result.valid).toBe(true)
          expect(result.error).toBeNull()
        }
      ),
      PBT_CONFIG
    )
  })

  it('CF with wrong check char is rejected', () => {
    fc.assert(
      fc.property(
        fc.string({ unit: fc.constantFrom(...alphanumChars), minLength: 15, maxLength: 15 }).chain(cf15 => {
          const correctCheck = computeCFCheckChar(cf15)
          const wrongLetters = CHECK_LETTER.split('').filter(l => l !== correctCheck)
          return fc.constantFrom(...wrongLetters).map(wrongCheck => cf15 + wrongCheck)
        }),
        (cf) => {
          const result = validateCodiceFiscale(cf)
          expect(result.valid).toBe(false)
          expect(result.error).toBe('Carattere di controllo non corretto')
        }
      ),
      PBT_CONFIG
    )
  })
})

// Feature: gestione-microchip, Property 8: Validazione date non future
// **Validates: Requirements 3.2, 4.6, 8.3, 16.4**
describe('Property 8: Future dates always rejected', () => {
  it('dates 1-1000 days in the future are rejected with allowFuture=false', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }).map(daysAhead => {
          const future = new Date()
          future.setDate(future.getDate() + daysAhead)
          const day = String(future.getDate()).padStart(2, '0')
          const month = String(future.getMonth() + 1).padStart(2, '0')
          const year = future.getFullYear()
          return `${day}/${month}/${year}`
        }),
        (dateStr) => {
          const result = validateDate(dateStr, { allowFuture: false })
          expect(result.valid).toBe(false)
          expect(result.error).toContain('futuro')
        }
      ),
      PBT_CONFIG
    )
  })

  it('dates 0-1000 days in the past are accepted with allowFuture=false', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }).map(daysBack => {
          const past = new Date()
          past.setDate(past.getDate() - daysBack)
          const day = String(past.getDate()).padStart(2, '0')
          const month = String(past.getMonth() + 1).padStart(2, '0')
          const year = past.getFullYear()
          return `${day}/${month}/${year}`
        }),
        (dateStr) => {
          const result = validateDate(dateStr, { allowFuture: false })
          expect(result.valid).toBe(true)
          expect(result.error).toBeNull()
        }
      ),
      PBT_CONFIG
    )
  })
})
