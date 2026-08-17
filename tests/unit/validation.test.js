import { describe, it, expect } from 'vitest'
import { validateChipNumber, validateCodiceFiscale, validateDate, validateForm } from '../../js/validation.js'

describe('validateChipNumber', () => {
  it('accetta un numero chip di 15 cifre valido', () => {
    const result = validateChipNumber('123456789012345')
    expect(result.valid).toBe(true)
    expect(result.error).toBeNull()
  })

  it('accetta numero chip di tutti zeri', () => {
    const result = validateChipNumber('000000000000000')
    expect(result.valid).toBe(true)
  })

  it('rifiuta stringa vuota', () => {
    const result = validateChipNumber('')
    expect(result.valid).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('rifiuta null', () => {
    const result = validateChipNumber(null)
    expect(result.valid).toBe(false)
  })

  it('rifiuta numero con meno di 15 cifre', () => {
    const result = validateChipNumber('12345678901234')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('15 cifre')
  })

  it('rifiuta numero con più di 15 cifre', () => {
    const result = validateChipNumber('1234567890123456')
    expect(result.valid).toBe(false)
  })

  it('rifiuta stringa con lettere', () => {
    const result = validateChipNumber('12345678901234A')
    expect(result.valid).toBe(false)
  })

  it('rifiuta stringa con spazi', () => {
    const result = validateChipNumber('123 56789012345')
    expect(result.valid).toBe(false)
  })

  it('rifiuta stringa con caratteri speciali', () => {
    const result = validateChipNumber('12345678901234!')
    expect(result.valid).toBe(false)
  })

  it('trimma gli spazi iniziali e finali', () => {
    const result = validateChipNumber(' 123456789012345 ')
    expect(result.valid).toBe(true)
  })
})

describe('validateCodiceFiscale', () => {
  // CF noti validi per verificare l'algoritmo
  it('accetta un CF valido (RSSMRA85M01H501Q)', () => {
    const result = validateCodiceFiscale('RSSMRA85M01H501Q')
    expect(result.valid).toBe(true)
    expect(result.error).toBeNull()
  })

  it('accetta un CF valido (VRDLGI90A01F205J)', () => {
    const result = validateCodiceFiscale('VRDLGI90A01F205J')
    expect(result.valid).toBe(true)
  })

  it('accetta CF in lowercase (case insensitive)', () => {
    const result = validateCodiceFiscale('rssmra85m01h501q')
    expect(result.valid).toBe(true)
  })

  it('accetta CF in mixed case', () => {
    const result = validateCodiceFiscale('RssMRA85M01h501Q')
    expect(result.valid).toBe(true)
  })

  it('rifiuta stringa vuota', () => {
    const result = validateCodiceFiscale('')
    expect(result.valid).toBe(false)
  })

  it('rifiuta null', () => {
    const result = validateCodiceFiscale(null)
    expect(result.valid).toBe(false)
  })

  it('rifiuta CF con lunghezza diversa da 16 - troppo corto', () => {
    const result = validateCodiceFiscale('RSSMRA85M01H50')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Deve essere di 16 caratteri')
  })

  it('rifiuta CF con lunghezza diversa da 16 - troppo lungo', () => {
    const result = validateCodiceFiscale('RSSMRA85M01H501UA')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Deve essere di 16 caratteri')
  })

  it('rifiuta CF con caratteri non alfanumerici', () => {
    const result = validateCodiceFiscale('RSSMRA85M01H50!U')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Deve contenere solo caratteri alfanumerici')
  })

  it('rifiuta CF con carattere di controllo errato', () => {
    // Il check corretto per RSSMRA85M01H501 è Q, uso A per generare l'errore
    const result = validateCodiceFiscale('RSSMRA85M01H501A')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Carattere di controllo non corretto')
  })

  it('rifiuta CF con spazi interni', () => {
    const result = validateCodiceFiscale('RSS MRA85M01H501')
    expect(result.valid).toBe(false)
  })

  it('valida correttamente BNCLRA80A01H501Z', () => {
    const result = validateCodiceFiscale('BNCLRA80A01H501Z')
    expect(result.valid).toBe(true)
  })
})

describe('validateDate', () => {
  it('accetta una data valida in formato DD/MM/YYYY', () => {
    const result = validateDate('15/06/2023')
    expect(result.valid).toBe(true)
    expect(result.error).toBeNull()
    expect(result.date).toBeInstanceOf(Date)
    expect(result.date.getDate()).toBe(15)
    expect(result.date.getMonth()).toBe(5) // giugno = 5 (0-indexed)
    expect(result.date.getFullYear()).toBe(2023)
  })

  it('accetta il primo giorno del mese', () => {
    const result = validateDate('01/01/2020')
    expect(result.valid).toBe(true)
  })

  it('rifiuta stringa vuota', () => {
    const result = validateDate('')
    expect(result.valid).toBe(false)
    expect(result.date).toBeNull()
  })

  it('rifiuta null', () => {
    const result = validateDate(null)
    expect(result.valid).toBe(false)
  })

  it('rifiuta formato non valido (YYYY-MM-DD)', () => {
    const result = validateDate('2023-06-15')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('GG/MM/AAAA')
  })

  it('rifiuta formato non valido (D/M/YYYY)', () => {
    const result = validateDate('5/6/2023')
    expect(result.valid).toBe(false)
  })

  it('rifiuta date impossibili (31 febbraio)', () => {
    const result = validateDate('31/02/2023')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Formato data non valido')
  })

  it('rifiuta mese 13', () => {
    const result = validateDate('15/13/2023')
    expect(result.valid).toBe(false)
  })

  it('rifiuta giorno 0', () => {
    const result = validateDate('00/06/2023')
    expect(result.valid).toBe(false)
  })

  it('rifiuta data futura per default', () => {
    const futureDate = new Date()
    futureDate.setFullYear(futureDate.getFullYear() + 1)
    const day = String(futureDate.getDate()).padStart(2, '0')
    const month = String(futureDate.getMonth() + 1).padStart(2, '0')
    const year = futureDate.getFullYear()
    const dateStr = `${day}/${month}/${year}`

    const result = validateDate(dateStr)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('futuro')
  })

  it('accetta data futura se allowFuture è true', () => {
    const futureDate = new Date()
    futureDate.setFullYear(futureDate.getFullYear() + 1)
    const day = String(futureDate.getDate()).padStart(2, '0')
    const month = String(futureDate.getMonth() + 1).padStart(2, '0')
    const year = futureDate.getFullYear()
    const dateStr = `${day}/${month}/${year}`

    const result = validateDate(dateStr, { allowFuture: true })
    expect(result.valid).toBe(true)
  })

  it('accetta la data odierna', () => {
    const today = new Date()
    const day = String(today.getDate()).padStart(2, '0')
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const year = today.getFullYear()
    const dateStr = `${day}/${month}/${year}`

    const result = validateDate(dateStr)
    expect(result.valid).toBe(true)
  })

  it('rifiuta data anteriore a minDate', () => {
    const result = validateDate('01/01/2020', { minDate: new Date(2021, 0, 1) })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('anteriore')
  })

  it('accetta data uguale a minDate', () => {
    const result = validateDate('01/01/2021', { minDate: new Date(2021, 0, 1) })
    expect(result.valid).toBe(true)
  })

  it('accetta data successiva a minDate', () => {
    const result = validateDate('15/06/2021', { minDate: new Date(2021, 0, 1) })
    expect(result.valid).toBe(true)
  })

  it('accetta 29 febbraio in anno bisestile', () => {
    const result = validateDate('29/02/2024', { allowFuture: true })
    expect(result.valid).toBe(true)
  })

  it('rifiuta 29 febbraio in anno non bisestile', () => {
    const result = validateDate('29/02/2023')
    expect(result.valid).toBe(false)
  })
})

describe('validateForm', () => {
  // Helper per creare un form fittizio nel DOM
  function createMockForm(fields) {
    const form = document.createElement('form')
    for (const [id, value, type] of fields) {
      const input = document.createElement('input')
      input.id = id
      input.name = id
      if (type === 'checkbox') {
        input.type = 'checkbox'
        input.checked = value
      } else {
        input.type = type || 'text'
        input.value = value
      }
      form.appendChild(input)
    }
    return form
  }

  it('ritorna valid=true quando tutti i campi sono validi', () => {
    const form = createMockForm([
      ['chip', '123456789012345', 'text']
    ])

    const result = validateForm(form, [
      { fieldId: 'chip', validator: validateChipNumber }
    ])

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('ritorna tutti gli errori simultaneamente', () => {
    const form = createMockForm([
      ['chip', '123', 'text'],
      ['cf', 'INVALID', 'text']
    ])

    const result = validateForm(form, [
      { fieldId: 'chip', validator: validateChipNumber },
      { fieldId: 'cf', validator: validateCodiceFiscale }
    ])

    expect(result.valid).toBe(false)
    expect(result.errors).toHaveLength(2)
    expect(result.errors[0].field).toBe('chip')
    expect(result.errors[1].field).toBe('cf')
  })

  it('gestisce campi non trovati nel form (valore vuoto)', () => {
    const form = createMockForm([])

    const result = validateForm(form, [
      { fieldId: 'nonexistent', validator: validateChipNumber }
    ])

    expect(result.valid).toBe(false)
    expect(result.errors).toHaveLength(1)
  })

  it('passa options al validatore', () => {
    const form = createMockForm([
      ['data', '01/01/2020', 'text']
    ])

    const result = validateForm(form, [
      { fieldId: 'data', validator: validateDate, options: { minDate: new Date(2021, 0, 1) } }
    ])

    expect(result.valid).toBe(false)
    expect(result.errors[0].message).toContain('anteriore')
  })

  it('supporta checkbox (valore booleano)', () => {
    const form = createMockForm([
      ['privacy', false, 'checkbox']
    ])

    // Validatore custom per checkbox
    const requireChecked = (value) => ({
      valid: value === true,
      error: value === true ? null : 'Checkbox obbligatoria'
    })

    const result = validateForm(form, [
      { fieldId: 'privacy', validator: requireChecked }
    ])

    expect(result.valid).toBe(false)
    expect(result.errors[0].message).toBe('Checkbox obbligatoria')
  })

  it('ritorna valid=true per checkbox spuntata', () => {
    const form = createMockForm([
      ['privacy', true, 'checkbox']
    ])

    const requireChecked = (value) => ({
      valid: value === true,
      error: value === true ? null : 'Checkbox obbligatoria'
    })

    const result = validateForm(form, [
      { fieldId: 'privacy', validator: requireChecked }
    ])

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
})
