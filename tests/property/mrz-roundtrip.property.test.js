/**
 * Property-Based Tests — MRZ Round-Trip e Check Digit Rejection
 *
 * Feature: gestione-microchip, Property 1: MRZ round-trip (parse → format → parse)
 * Feature: gestione-microchip, Property 2: MRZ format → parse round-trip
 * Feature: gestione-microchip, Property 10: MRZ check digit rejection
 *
 * Validates: Requirements 7.2, 7.3, 7.4, 7.5
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { parseMRZ, formatMRZ, validateCheckDigits, computeCheckDigit } from '../../js/mrz-parser.js'

const PBT_CONFIG = { numRuns: 100 }

// Generatore per oggetti MRZ validi (fast-check v4 API)
const alphaArb = fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''))
const alphaNumArb = fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split(''))

const mrzFieldsArb = fc.record({
  documentCode: fc.constantFrom('ID', 'I<'),
  issuingState: fc.string({ unit: alphaArb, minLength: 3, maxLength: 3 }),
  documentNumber: fc.string({ unit: alphaNumArb, minLength: 9, maxLength: 9 }),
  optionalData1: fc.oneof(fc.constant(''), fc.string({ unit: alphaNumArb, minLength: 1, maxLength: 15 })),
  dateOfBirth: fc.tuple(fc.integer({ min: 0, max: 99 }), fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 28 })).map(([y, m, d]) => String(y).padStart(2, '0') + String(m).padStart(2, '0') + String(d).padStart(2, '0')),
  sex: fc.constantFrom('M', 'F', ''),
  expiryDate: fc.tuple(fc.integer({ min: 0, max: 99 }), fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 28 })).map(([y, m, d]) => String(y).padStart(2, '0') + String(m).padStart(2, '0') + String(d).padStart(2, '0')),
  nationality: fc.string({ unit: alphaArb, minLength: 3, maxLength: 3 }),
  optionalData2: fc.oneof(fc.constant(''), fc.string({ unit: alphaNumArb, minLength: 1, maxLength: 11 })),
  surname: fc.string({ unit: alphaArb, minLength: 1, maxLength: 12 }),
  givenNames: fc.string({ unit: alphaArb, minLength: 1, maxLength: 12 })
})

describe('Property 1: MRZ format → parse round-trip', () => {
  /**
   * **Validates: Requirements 7.3, 7.4**
   *
   * For any valid MRZ field object, formatting followed by parsing SHALL produce
   * an object with identical field values compared to the original.
   */
  it('formatMRZ(fields) → parseMRZ(result) produces matching fields', () => {
    fc.assert(
      fc.property(mrzFieldsArb, (fields) => {
        const lines = formatMRZ(fields)
        const { fields: parsed, errors } = parseMRZ(lines)

        // Formatting should always produce valid MRZ (no check digit errors)
        expect(errors).toHaveLength(0)
        expect(parsed).not.toBeNull()

        // documentCode: 'I<' formats as 'I<' but parseMRZ trims trailing '<' via cleanField
        // so we compare trimmed versions
        expect(parsed.documentCode).toBe(fields.documentCode.replace(/</g, ' ').trim())
        expect(parsed.issuingState).toBe(fields.issuingState)
        expect(parsed.documentNumber).toBe(fields.documentNumber)
        expect(parsed.dateOfBirth).toBe(fields.dateOfBirth)
        expect(parsed.sex).toBe(fields.sex)
        expect(parsed.expiryDate).toBe(fields.expiryDate)
        expect(parsed.nationality).toBe(fields.nationality)
        expect(parsed.surname).toBe(fields.surname)
        expect(parsed.givenNames).toBe(fields.givenNames)
        expect(parsed.optionalData1).toBe(fields.optionalData1)
        expect(parsed.optionalData2).toBe(fields.optionalData2)
      }),
      PBT_CONFIG
    )
  })
})

describe('Property 2: MRZ format → parse → format stability', () => {
  /**
   * **Validates: Requirements 7.3, 7.4**
   *
   * For any valid MRZ field object, formatMRZ(parseMRZ(formatMRZ(fields)).fields)
   * SHALL produce the same output as formatMRZ(fields).
   */
  it('formatMRZ(parseMRZ(formatMRZ(fields)).fields) === formatMRZ(fields)', () => {
    fc.assert(
      fc.property(mrzFieldsArb, (fields) => {
        const formatted1 = formatMRZ(fields)
        const { fields: parsed, errors } = parseMRZ(formatted1)

        expect(errors).toHaveLength(0)
        expect(parsed).not.toBeNull()

        const formatted2 = formatMRZ(parsed)

        expect(formatted2[0]).toBe(formatted1[0])
        expect(formatted2[1]).toBe(formatted1[1])
        expect(formatted2[2]).toBe(formatted1[2])
      }),
      PBT_CONFIG
    )
  })
})

describe('Property 10: MRZ check digit rejection', () => {
  /**
   * **Validates: Requirements 7.2, 7.5**
   *
   * For any valid MRZ string with at least one check digit corrupted,
   * validateCheckDigits SHALL reject the input (valid=false).
   */
  it('corrupting a check digit position causes validation to fail', () => {
    // Check digit positions in the 90-character MRZ:
    // Position 14: document number check digit (line 1, pos 14)
    // Position 36: date of birth check digit (line 2, pos 6 → absolute 30+6=36)
    // Position 44: expiry date check digit (line 2, pos 14 → absolute 30+14=44)
    // Position 59: composite check digit (line 2, pos 29 → absolute 30+29=59)
    const checkDigitPositions = [14, 36, 44, 59]

    fc.assert(
      fc.property(
        mrzFieldsArb,
        fc.constantFrom(...checkDigitPositions),
        (fields, position) => {
          const lines = formatMRZ(fields)
          const mrzString = lines.join('')

          // Verify the original is valid
          const originalResult = validateCheckDigits(mrzString)
          expect(originalResult.valid).toBe(true)

          // Corrupt the check digit at the chosen position with a different digit
          const currentChar = mrzString[position]
          const digits = '0123456789'
          const replacement = digits[(digits.indexOf(currentChar) + 1) % 10]

          const corrupted = mrzString.substring(0, position) + replacement + mrzString.substring(position + 1)

          const result = validateCheckDigits(corrupted)
          expect(result.valid).toBe(false)
          expect(result.errors.length).toBeGreaterThan(0)
        }
      ),
      PBT_CONFIG
    )
  })
})
