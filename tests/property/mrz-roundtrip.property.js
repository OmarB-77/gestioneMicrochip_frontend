/**
 * Property-Based Tests: MRZ Round-Trip
 *
 * Feature: gestione-microchip, Property 1: MRZ round-trip (parse → format → parse)
 * Feature: gestione-microchip, Property 2: MRZ format → parse round-trip
 * Feature: gestione-microchip, Property 10: MRZ check digit rejection
 *
 * **Validates: Requirements 7.2, 7.3, 7.4, 7.5**
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { parseMRZ, formatMRZ, validateCheckDigits, computeCheckDigit } from '../../js/mrz-parser.js'

const PBT_CONFIG = { numRuns: 100 }

// --- Generators ---

const uppercaseLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const alphanumericChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')

/**
 * Generate a string of given length from a character set using fc.array + map.
 * fast-check v4 removed stringOf, so we use this approach.
 */
function stringFromChars(chars, minLength, maxLength) {
  return fc.array(fc.constantFrom(...chars), { minLength, maxLength })
    .map(arr => arr.join(''))
}

/** Generator for valid MRZ field objects */
const mrzFieldsArb = fc.record({
  documentCode: fc.constantFrom('ID', 'I<', 'P<'),
  issuingState: stringFromChars(uppercaseLetters, 3, 3),
  documentNumber: stringFromChars(alphanumericChars, 9, 9),
  optionalData1: stringFromChars(alphanumericChars, 0, 15),
  dateOfBirth: fc.tuple(
    fc.integer({ min: 0, max: 99 }).map(y => String(y).padStart(2, '0')),
    fc.integer({ min: 1, max: 12 }).map(m => String(m).padStart(2, '0')),
    fc.integer({ min: 1, max: 28 }).map(d => String(d).padStart(2, '0'))
  ).map(([y, m, d]) => y + m + d),
  sex: fc.constantFrom('M', 'F', ''),
  expiryDate: fc.tuple(
    fc.integer({ min: 0, max: 99 }).map(y => String(y).padStart(2, '0')),
    fc.integer({ min: 1, max: 12 }).map(m => String(m).padStart(2, '0')),
    fc.integer({ min: 1, max: 28 }).map(d => String(d).padStart(2, '0'))
  ).map(([y, m, d]) => y + m + d),
  nationality: stringFromChars(uppercaseLetters, 3, 3),
  optionalData2: stringFromChars(alphanumericChars, 0, 11),
  surname: stringFromChars(uppercaseLetters, 1, 15),
  givenNames: fc.oneof(
    stringFromChars(uppercaseLetters, 1, 15),
    // Compound names with a space
    fc.tuple(
      stringFromChars(uppercaseLetters, 1, 7),
      stringFromChars(uppercaseLetters, 1, 7)
    ).map(([a, b]) => a + ' ' + b)
  )
})

// --- Property 1: parse → format → parse round-trip ---

describe('Property 1: MRZ round-trip (parse → format → parse)', () => {
  it('parsing a valid formatted MRZ, then reformatting and reparsing yields identical fields', () => {
    fc.assert(
      fc.property(mrzFieldsArb, (fields) => {
        // Step a: format the fields object into MRZ lines
        const formatted = formatMRZ(fields)

        // Step b: parse the formatted MRZ
        const parsed1 = parseMRZ(formatted)

        // The parse must succeed (no check digit errors since formatMRZ computes them)
        expect(parsed1.errors).toHaveLength(0)
        expect(parsed1.fields).not.toBeNull()

        // Step c: reformat the parsed fields
        const reformatted = formatMRZ(parsed1.fields)

        // Step d: reparse and verify identical fields
        const parsed2 = parseMRZ(reformatted)
        expect(parsed2.errors).toHaveLength(0)
        expect(parsed2.fields).not.toBeNull()

        // Compare all semantic fields between first and second parse
        expect(parsed2.fields.documentCode).toBe(parsed1.fields.documentCode)
        expect(parsed2.fields.issuingState).toBe(parsed1.fields.issuingState)
        expect(parsed2.fields.documentNumber).toBe(parsed1.fields.documentNumber)
        expect(parsed2.fields.optionalData1).toBe(parsed1.fields.optionalData1)
        expect(parsed2.fields.dateOfBirth).toBe(parsed1.fields.dateOfBirth)
        expect(parsed2.fields.sex).toBe(parsed1.fields.sex)
        expect(parsed2.fields.expiryDate).toBe(parsed1.fields.expiryDate)
        expect(parsed2.fields.nationality).toBe(parsed1.fields.nationality)
        expect(parsed2.fields.optionalData2).toBe(parsed1.fields.optionalData2)
        expect(parsed2.fields.surname).toBe(parsed1.fields.surname)
        expect(parsed2.fields.givenNames).toBe(parsed1.fields.givenNames)
      }),
      PBT_CONFIG
    )
  })
})

// --- Property 2: format → parse → format round-trip ---

describe('Property 2: MRZ format → parse round-trip', () => {
  it('formatting fields, parsing, then reformatting produces identical MRZ lines', () => {
    fc.assert(
      fc.property(mrzFieldsArb, (fields) => {
        // Step a: format the fields object into MRZ lines
        const formatted1 = formatMRZ(fields)

        // Step b: parse the formatted MRZ
        const parsed = parseMRZ(formatted1)
        expect(parsed.errors).toHaveLength(0)
        expect(parsed.fields).not.toBeNull()

        // Step c: reformat the parsed fields
        const formatted2 = formatMRZ(parsed.fields)

        // The two formatted outputs must be identical line by line
        expect(formatted2[0]).toBe(formatted1[0])
        expect(formatted2[1]).toBe(formatted1[1])
        expect(formatted2[2]).toBe(formatted1[2])
      }),
      PBT_CONFIG
    )
  })
})

// --- Property 10: MRZ check digit rejection ---

describe('Property 10: MRZ check digit rejection', () => {
  // Check digit positions in the 90-char MRZ string:
  // Position 14: document number check digit (line 1, pos 14)
  // Position 36: date of birth check digit (line 2, pos 6 → absolute 30+6=36)
  // Position 44: expiry date check digit (line 2, pos 14 → absolute 30+14=44)
  // Position 59: composite check digit (line 2, pos 29 → absolute 30+29=59)
  const checkDigitPositions = [14, 36, 44, 59]

  it('corrupting any single check digit causes validateCheckDigits to return valid=false', () => {
    fc.assert(
      fc.property(
        mrzFieldsArb,
        fc.constantFrom(...checkDigitPositions),
        fc.integer({ min: 1, max: 9 }),
        (fields, position, offset) => {
          // Generate a valid MRZ string
          const formatted = formatMRZ(fields)
          const mrzString = formatted.join('')

          // Get the original digit at this position
          const originalDigit = parseInt(mrzString[position])

          // Compute a different digit by adding offset modulo 10
          const corruptDigit = String((originalDigit + offset) % 10)

          // Corrupt the MRZ at the check digit position
          const corrupted = mrzString.substring(0, position) + corruptDigit + mrzString.substring(position + 1)

          // validateCheckDigits must detect the corruption
          const result = validateCheckDigits(corrupted)
          expect(result.valid).toBe(false)
          expect(result.errors.length).toBeGreaterThan(0)
        }
      ),
      PBT_CONFIG
    )
  })
})
