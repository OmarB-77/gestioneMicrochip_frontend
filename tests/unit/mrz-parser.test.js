import { describe, it, expect } from 'vitest'
import { parseMRZ, formatMRZ, validateCheckDigits, computeCheckDigit } from '../../js/mrz-parser.js'

describe('computeCheckDigit', () => {
  it('calcola correttamente per stringa di tutti zeri', () => {
    // 0×7 + 0×3 + 0×1 + ... = 0, 0 mod 10 = 0
    expect(computeCheckDigit('000000000')).toBe('0')
  })

  it('calcola correttamente per stringa con lettere', () => {
    // A=10, B=11: 10×7=70, 11×3=33 → 103, 103%10=3
    expect(computeCheckDigit('AB')).toBe('3')
  })

  it('calcola correttamente per stringa con filler <', () => {
    // < = 0, stesso di '0'
    expect(computeCheckDigit('<<<')).toBe('0')
  })

  it('calcola correttamente per data 850101', () => {
    // 8×7=56, 5×3=15, 0×1=0, 1×7=7, 0×3=0, 1×1=1 = 79 → 79%10=9
    expect(computeCheckDigit('850101')).toBe('9')
  })

  it('calcola correttamente per data 300101', () => {
    // 3×7=21, 0×3=0, 0×1=0, 1×7=7, 0×3=0, 1×1=1 = 29 → 29%10=9
    expect(computeCheckDigit('300101')).toBe('9')
  })

  it('calcola correttamente per un numero documento noto', () => {
    // Verifica con L898902C3 (esempio ICAO noto): 
    // L=21, 8=8, 9=9, 8=8, 9=9, 0=0, 2=2, C=12, 3=3
    // 21×7=147, 8×3=24, 9×1=9, 8×7=56, 9×3=27, 0×1=0, 2×7=14, 12×3=36, 3×1=3 = 316
    // 316%10=6
    expect(computeCheckDigit('L898902C3')).toBe('6')
  })

  it('restituisce 0 per stringa vuota', () => {
    expect(computeCheckDigit('')).toBe('0')
  })
})

// Costruiamo una MRZ TD1 valida calcolando i check digit corretti
function buildValidMRZ() {
  const docCode = 'ID'
  const issuingState = 'ITA'
  const docNum = '000000000'
  const docNumCheck = computeCheckDigit(docNum)
  const opt1 = '<<<<<<<<<<<<<<<'
  const line1 = docCode + issuingState + docNum + docNumCheck + opt1

  const dob = '850101'
  const dobCheck = computeCheckDigit(dob)
  const sex = 'M'
  const expiry = '300101'
  const expiryCheck = computeCheckDigit(expiry)
  const nat = 'ITA'
  const opt2 = '<<<<<<<<<<<'

  const compositeInput = docNum + docNumCheck + opt1 + dob + dobCheck + expiry + expiryCheck + opt2
  const compositeCheck = computeCheckDigit(compositeInput)

  const line2 = dob + dobCheck + sex + expiry + expiryCheck + nat + opt2 + compositeCheck

  const line3 = 'ROSSI<<MARIO<<<<<<<<<<<<<<<<<<'

  return { line1, line2, line3, full: line1 + line2 + line3 }
}

describe('parseMRZ', () => {
  it('esegue il parsing di una MRZ TD1 italiana valida', () => {
    const { full } = buildValidMRZ()
    const result = parseMRZ(full)

    expect(result.errors).toHaveLength(0)
    expect(result.fields).not.toBeNull()
    expect(result.fields.documentCode).toBe('ID')
    expect(result.fields.issuingState).toBe('ITA')
    expect(result.fields.documentNumber).toBe('000000000')
    expect(result.fields.dateOfBirth).toBe('850101')
    expect(result.fields.sex).toBe('M')
    expect(result.fields.expiryDate).toBe('300101')
    expect(result.fields.nationality).toBe('ITA')
    expect(result.fields.surname).toBe('ROSSI')
    expect(result.fields.givenNames).toBe('MARIO')
  })

  it('accetta input come array di 3 stringhe', () => {
    const { line1, line2, line3 } = buildValidMRZ()
    const result = parseMRZ([line1, line2, line3])

    expect(result.errors).toHaveLength(0)
    expect(result.fields.surname).toBe('ROSSI')
    expect(result.fields.givenNames).toBe('MARIO')
  })

  it('pulisce i filler < dai campi testuali', () => {
    const { full } = buildValidMRZ()
    const result = parseMRZ(full)

    expect(result.fields.optionalData1).toBe('')
    expect(result.fields.optionalData2).toBe('')
  })

  it('gestisce sesso non specificato (< → stringa vuota)', () => {
    const docNum = '000000000'
    const docNumCheck = computeCheckDigit(docNum)
    const opt1 = '<<<<<<<<<<<<<<<'
    const line1 = 'ID' + 'ITA' + docNum + docNumCheck + opt1

    const dob = '850101'
    const dobCheck = computeCheckDigit(dob)
    const sex = '<'
    const expiry = '300101'
    const expiryCheck = computeCheckDigit(expiry)
    const nat = 'ITA'
    const opt2 = '<<<<<<<<<<<'
    const compositeInput = docNum + docNumCheck + opt1 + dob + dobCheck + expiry + expiryCheck + opt2
    const compositeCheck = computeCheckDigit(compositeInput)
    const line2 = dob + dobCheck + sex + expiry + expiryCheck + nat + opt2 + compositeCheck
    const line3 = 'ROSSI<<MARIO<<<<<<<<<<<<<<<<<<'

    const result = parseMRZ(line1 + line2 + line3)
    expect(result.fields.sex).toBe('')
  })

  it('rifiuta input con lunghezza errata', () => {
    const result = parseMRZ('ABC')
    expect(result.fields).toBeNull()
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain('Lunghezza')
  })

  it('rifiuta input con caratteri non ammessi', () => {
    const invalid = 'a'.repeat(90).toUpperCase().replace(/A/g, '@') // @ non ammesso
    const result = parseMRZ('@'.repeat(90))
    expect(result.fields).toBeNull()
    expect(result.errors[0]).toContain('Caratteri non ammessi')
  })

  it('rifiuta input null', () => {
    const result = parseMRZ(null)
    expect(result.fields).toBeNull()
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('rifiuta array con numero errato di righe', () => {
    const result = parseMRZ(['AAAAAA', 'BBBBBB'])
    expect(result.fields).toBeNull()
    expect(result.errors[0]).toContain('3 righe')
  })

  it('segnala errore per check digit numero documento errato', () => {
    const { full } = buildValidMRZ()
    // Alteriamo il check digit del documento (posizione 14)
    const corrupted = full.substring(0, 14) + '9' + full.substring(15)
    const result = parseMRZ(corrupted)

    // I campi vengono comunque estratti
    expect(result.fields).not.toBeNull()
    // Ma ci sono errori di check digit
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors.some(e => e.includes('numero documento'))).toBe(true)
  })

  it('segnala errore per check digit data di nascita errato', () => {
    const { full } = buildValidMRZ()
    // Posizione check digit DOB: 30 (inizio riga 2) + 6 = 36
    const corrupted = full.substring(0, 36) + '0' + full.substring(37)
    const result = parseMRZ(corrupted)

    expect(result.fields).not.toBeNull()
    expect(result.errors.some(e => e.includes('data di nascita'))).toBe(true)
  })

  it('gestisce nomi composti separati da <', () => {
    const docNum = '000000000'
    const docNumCheck = computeCheckDigit(docNum)
    const opt1 = '<<<<<<<<<<<<<<<'
    const line1 = 'ID' + 'ITA' + docNum + docNumCheck + opt1

    const dob = '850101'
    const dobCheck = computeCheckDigit(dob)
    const expiry = '300101'
    const expiryCheck = computeCheckDigit(expiry)
    const opt2 = '<<<<<<<<<<<'
    const compositeInput = docNum + docNumCheck + opt1 + dob + dobCheck + expiry + expiryCheck + opt2
    const compositeCheck = computeCheckDigit(compositeInput)
    const line2 = dob + dobCheck + 'F' + expiry + expiryCheck + 'ITA' + opt2 + compositeCheck
    const line3 = 'DE<ROSSI<<MARIA<LUISA<<<<<<<<<'

    const result = parseMRZ(line1 + line2 + line3)
    expect(result.fields.surname).toBe('DE ROSSI')
    expect(result.fields.givenNames).toBe('MARIA LUISA')
  })
})

describe('formatMRZ', () => {
  it('produce output di 3 righe da 30 caratteri', () => {
    const fields = {
      documentCode: 'ID',
      issuingState: 'ITA',
      documentNumber: '000000000',
      optionalData1: '',
      dateOfBirth: '850101',
      sex: 'M',
      expiryDate: '300101',
      nationality: 'ITA',
      optionalData2: '',
      surname: 'ROSSI',
      givenNames: 'MARIO'
    }

    const lines = formatMRZ(fields)
    expect(lines).toHaveLength(3)
    expect(lines[0]).toHaveLength(30)
    expect(lines[1]).toHaveLength(30)
    expect(lines[2]).toHaveLength(30)
  })

  it('calcola correttamente le cifre di controllo', () => {
    const fields = {
      documentCode: 'ID',
      issuingState: 'ITA',
      documentNumber: '000000000',
      optionalData1: '',
      dateOfBirth: '850101',
      sex: 'M',
      expiryDate: '300101',
      nationality: 'ITA',
      optionalData2: '',
      surname: 'ROSSI',
      givenNames: 'MARIO'
    }

    const lines = formatMRZ(fields)
    const result = validateCheckDigits(lines)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('usa caratteri filler < per il padding', () => {
    const fields = {
      documentCode: 'ID',
      issuingState: 'ITA',
      documentNumber: '000000000',
      optionalData1: '',
      dateOfBirth: '850101',
      sex: 'M',
      expiryDate: '300101',
      nationality: 'ITA',
      optionalData2: '',
      surname: 'ROSSI',
      givenNames: 'MARIO'
    }

    const lines = formatMRZ(fields)
    // La riga 3 deve contenere il filler
    expect(lines[2]).toContain('<<<')
    // Ogni carattere deve essere valido
    const fullMrz = lines.join('')
    expect(/^[A-Z0-9<]+$/.test(fullMrz)).toBe(true)
  })

  it('gestisce sesso mancante come <', () => {
    const fields = {
      documentCode: 'ID',
      issuingState: 'ITA',
      documentNumber: '000000000',
      optionalData1: '',
      dateOfBirth: '850101',
      sex: '',
      expiryDate: '300101',
      nationality: 'ITA',
      optionalData2: '',
      surname: 'ROSSI',
      givenNames: 'MARIO'
    }

    const lines = formatMRZ(fields)
    // Posizione sex: riga 2 pos 7
    expect(lines[1][7]).toBe('<')
  })
})

describe('Round-trip: parseMRZ ↔ formatMRZ', () => {
  it('parse → format → parse produce campi identici', () => {
    const { full } = buildValidMRZ()
    const parsed1 = parseMRZ(full)
    expect(parsed1.errors).toHaveLength(0)

    const formatted = formatMRZ(parsed1.fields)
    const parsed2 = parseMRZ(formatted)
    expect(parsed2.errors).toHaveLength(0)

    expect(parsed2.fields.documentCode).toBe(parsed1.fields.documentCode)
    expect(parsed2.fields.issuingState).toBe(parsed1.fields.issuingState)
    expect(parsed2.fields.documentNumber).toBe(parsed1.fields.documentNumber)
    expect(parsed2.fields.dateOfBirth).toBe(parsed1.fields.dateOfBirth)
    expect(parsed2.fields.sex).toBe(parsed1.fields.sex)
    expect(parsed2.fields.expiryDate).toBe(parsed1.fields.expiryDate)
    expect(parsed2.fields.nationality).toBe(parsed1.fields.nationality)
    expect(parsed2.fields.surname).toBe(parsed1.fields.surname)
    expect(parsed2.fields.givenNames).toBe(parsed1.fields.givenNames)
    expect(parsed2.fields.optionalData1).toBe(parsed1.fields.optionalData1)
    expect(parsed2.fields.optionalData2).toBe(parsed1.fields.optionalData2)
  })

  it('format → parse → format produce righe identiche', () => {
    const fields = {
      documentCode: 'ID',
      issuingState: 'ITA',
      documentNumber: '123456789',
      optionalData1: '',
      dateOfBirth: '900515',
      sex: 'F',
      expiryDate: '350515',
      nationality: 'ITA',
      optionalData2: '',
      surname: 'BIANCHI',
      givenNames: 'ANNA MARIA'
    }

    const formatted1 = formatMRZ(fields)
    const parsed = parseMRZ(formatted1)
    expect(parsed.errors).toHaveLength(0)

    const formatted2 = formatMRZ(parsed.fields)
    expect(formatted2[0]).toBe(formatted1[0])
    expect(formatted2[1]).toBe(formatted1[1])
    expect(formatted2[2]).toBe(formatted1[2])
  })

  it('round-trip con dati opzionali popolati', () => {
    const fields = {
      documentCode: 'I<',
      issuingState: 'ITA',
      documentNumber: 'AB1234567',
      optionalData1: 'EXTRA1',
      dateOfBirth: '750320',
      sex: 'M',
      expiryDate: '280320',
      nationality: 'ITA',
      optionalData2: 'OPT2DATA',
      surname: 'VERDI',
      givenNames: 'GIUSEPPE'
    }

    const formatted = formatMRZ(fields)
    const parsed = parseMRZ(formatted)
    expect(parsed.errors).toHaveLength(0)

    expect(parsed.fields.documentCode).toBe('I')
    expect(parsed.fields.issuingState).toBe('ITA')
    expect(parsed.fields.documentNumber).toBe('AB1234567')
    expect(parsed.fields.optionalData1).toBe('EXTRA1')
    expect(parsed.fields.dateOfBirth).toBe('750320')
    expect(parsed.fields.sex).toBe('M')
    expect(parsed.fields.expiryDate).toBe('280320')
    expect(parsed.fields.nationality).toBe('ITA')
    expect(parsed.fields.optionalData2).toBe('OPT2DATA')
    expect(parsed.fields.surname).toBe('VERDI')
    expect(parsed.fields.givenNames).toBe('GIUSEPPE')
  })
})

describe('validateCheckDigits', () => {
  it('ritorna valid=true per MRZ con check digit corretti', () => {
    const { full } = buildValidMRZ()
    const result = validateCheckDigits(full)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('ritorna valid=false per MRZ con check digit numero documento errato', () => {
    const { full } = buildValidMRZ()
    // Alteriamo il check digit del documento (posizione 14)
    const corrupted = full.substring(0, 14) + '5' + full.substring(15)
    const result = validateCheckDigits(corrupted)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('numero documento'))).toBe(true)
  })

  it('ritorna valid=false per MRZ con check digit DOB errato', () => {
    const { full } = buildValidMRZ()
    // Alteriamo il check digit DOB (posizione 36)
    const corrupted = full.substring(0, 36) + '0' + full.substring(37)
    const result = validateCheckDigits(corrupted)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('data di nascita'))).toBe(true)
  })

  it('ritorna valid=false per MRZ con check digit scadenza errato', () => {
    const { full } = buildValidMRZ()
    // Check digit expiry: riga 2 pos 14 → posizione assoluta 30+14=44
    const corrupted = full.substring(0, 44) + '0' + full.substring(45)
    const result = validateCheckDigits(corrupted)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('data di scadenza'))).toBe(true)
  })

  it('ritorna valid=false per MRZ con check digit composito errato', () => {
    const { full } = buildValidMRZ()
    // Check digit composito: riga 2 pos 29 → posizione assoluta 30+29=59
    const corrupted = full.substring(0, 59) + '5' + full.substring(60)
    const result = validateCheckDigits(corrupted)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('composito'))).toBe(true)
  })

  it('rifiuta input non valido (lunghezza errata)', () => {
    const result = validateCheckDigits('TROPPO CORTO')
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('accetta input come array di 3 stringhe', () => {
    const { line1, line2, line3 } = buildValidMRZ()
    const result = validateCheckDigits([line1, line2, line3])
    expect(result.valid).toBe(true)
  })

  it('segnala più errori simultaneamente', () => {
    const { full } = buildValidMRZ()
    // Alteriamo check digit documento (pos 14) e DOB (pos 36)
    let corrupted = full.substring(0, 14) + '5' + full.substring(15)
    corrupted = corrupted.substring(0, 36) + '0' + corrupted.substring(37)
    const result = validateCheckDigits(corrupted)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(2)
  })
})
