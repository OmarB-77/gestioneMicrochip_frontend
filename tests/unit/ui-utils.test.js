// tests/unit/ui-utils.test.js — Unit test per il modulo ui-utils
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
    showToast,
    showFieldError,
    clearFieldError,
    clearAllErrors,
    scrollToFirstError,
    initDarkMode,
    toggleDarkMode
} from '../../js/ui-utils.js'

// Setup DOM minimale per i test
function setupDOM() {
    document.body.innerHTML = ''
    document.body.className = ''

    // Aggiungi il link dark-theme-link
    const link = document.createElement('link')
    link.id = 'dark-theme-link'
    link.rel = 'stylesheet'
    link.disabled = true
    document.head.appendChild(link)
}

function teardownDOM() {
    document.body.innerHTML = ''
    document.body.className = ''
    const link = document.getElementById('dark-theme-link')
    if (link) link.remove()
    localStorage.clear()
}

describe('showToast', () => {
    beforeEach(setupDOM)
    afterEach(teardownDOM)

    it('crea un elemento toast nel body', () => {
        showToast('Messaggio di test')
        const toast = document.querySelector('.toast')
        expect(toast).not.toBeNull()
        expect(toast.textContent).toBe('Messaggio di test')
    })

    it('aggiunge la classe toast-success per tipo success', () => {
        showToast('Salvato', 'success')
        const toast = document.querySelector('.toast')
        expect(toast.classList.contains('toast-success')).toBe(true)
    })

    it('aggiunge la classe toast-error per tipo error', () => {
        showToast('Errore', 'error')
        const toast = document.querySelector('.toast')
        expect(toast.classList.contains('toast-error')).toBe(true)
    })

    it('rimuove toast precedenti quando ne viene creato uno nuovo', () => {
        showToast('Primo')
        showToast('Secondo')
        const toasts = document.querySelectorAll('.toast')
        expect(toasts.length).toBe(1)
        expect(toasts[0].textContent).toBe('Secondo')
    })

    it('auto-rimuove il toast dopo 3 secondi', () => {
        vi.useFakeTimers()
        showToast('Temporaneo')
        expect(document.querySelector('.toast')).not.toBeNull()
        vi.advanceTimersByTime(3000)
        expect(document.querySelector('.toast')).toBeNull()
        vi.useRealTimers()
    })
})

describe('showFieldError / clearFieldError', () => {
    let form, input, errorSpan

    beforeEach(() => {
        setupDOM()
        form = document.createElement('form')
        const group = document.createElement('div')
        group.className = 'form-group'
        input = document.createElement('input')
        input.id = 'test-input'
        errorSpan = document.createElement('span')
        errorSpan.className = 'error-msg'
        group.appendChild(input)
        group.appendChild(errorSpan)
        form.appendChild(group)
        document.body.appendChild(form)
    })

    afterEach(teardownDOM)

    it('aggiunge classe .invalid e imposta messaggio errore', () => {
        showFieldError(input, 'Campo obbligatorio')
        expect(input.classList.contains('invalid')).toBe(true)
        expect(errorSpan.textContent).toBe('Campo obbligatorio')
    })

    it('clearFieldError rimuove classe .invalid e svuota messaggio', () => {
        showFieldError(input, 'Errore')
        clearFieldError(input)
        expect(input.classList.contains('invalid')).toBe(false)
        expect(errorSpan.textContent).toBe('')
    })

    it('gestisce gracefully un elemento null', () => {
        expect(() => showFieldError(null, 'test')).not.toThrow()
        expect(() => clearFieldError(null)).not.toThrow()
    })
})

describe('clearAllErrors', () => {
    let form

    beforeEach(() => {
        setupDOM()
        form = document.createElement('form')
        for (let i = 0; i < 3; i++) {
            const group = document.createElement('div')
            group.className = 'form-group'
            const input = document.createElement('input')
            input.classList.add('invalid')
            const errorSpan = document.createElement('span')
            errorSpan.className = 'error-msg'
            errorSpan.textContent = 'Errore ' + i
            group.appendChild(input)
            group.appendChild(errorSpan)
            form.appendChild(group)
        }
        document.body.appendChild(form)
    })

    afterEach(teardownDOM)

    it('rimuove tutte le classi .invalid e svuota tutti i messaggi', () => {
        clearAllErrors(form)
        expect(form.querySelectorAll('.invalid').length).toBe(0)
        form.querySelectorAll('.error-msg').forEach(span => {
            expect(span.textContent).toBe('')
        })
    })

    it('gestisce gracefully un form null', () => {
        expect(() => clearAllErrors(null)).not.toThrow()
    })
})

describe('scrollToFirstError', () => {
    let form, firstInput, secondInput

    beforeEach(() => {
        setupDOM()
        form = document.createElement('form')

        const group1 = document.createElement('div')
        firstInput = document.createElement('input')
        firstInput.scrollIntoView = vi.fn()
        firstInput.focus = vi.fn()
        group1.appendChild(firstInput)

        const group2 = document.createElement('div')
        secondInput = document.createElement('input')
        secondInput.classList.add('invalid')
        secondInput.scrollIntoView = vi.fn()
        secondInput.focus = vi.fn()
        group2.appendChild(secondInput)

        form.appendChild(group1)
        form.appendChild(group2)
        document.body.appendChild(form)
    })

    afterEach(teardownDOM)

    it('scrolla e focalizza il primo campo con .invalid', () => {
        scrollToFirstError(form)
        expect(secondInput.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
        expect(secondInput.focus).toHaveBeenCalled()
    })

    it('non fa nulla se non ci sono campi invalidi', () => {
        secondInput.classList.remove('invalid')
        expect(() => scrollToFirstError(form)).not.toThrow()
    })
})

describe('Dark Mode', () => {
    beforeEach(setupDOM)
    afterEach(teardownDOM)

    describe('initDarkMode', () => {
        it('applica dark mode se localStorage ha theme=dark', () => {
            localStorage.setItem('theme', 'dark')
            initDarkMode()
            expect(document.body.classList.contains('dark')).toBe(true)
            expect(document.getElementById('dark-theme-link').disabled).toBe(false)
        })

        it('non applica dark mode se localStorage ha theme=light', () => {
            localStorage.setItem('theme', 'light')
            initDarkMode()
            expect(document.body.classList.contains('dark')).toBe(false)
            expect(document.getElementById('dark-theme-link').disabled).toBe(true)
        })

        it('non applica dark mode se localStorage è vuoto', () => {
            initDarkMode()
            expect(document.body.classList.contains('dark')).toBe(false)
            expect(document.getElementById('dark-theme-link').disabled).toBe(true)
        })
    })

    describe('toggleDarkMode', () => {
        it('attiva dark mode e persiste la preferenza', () => {
            initDarkMode() // inizia in light
            toggleDarkMode()
            expect(document.body.classList.contains('dark')).toBe(true)
            expect(document.getElementById('dark-theme-link').disabled).toBe(false)
            expect(localStorage.getItem('theme')).toBe('dark')
        })

        it('disattiva dark mode e persiste la preferenza', () => {
            localStorage.setItem('theme', 'dark')
            initDarkMode()
            toggleDarkMode()
            expect(document.body.classList.contains('dark')).toBe(false)
            expect(document.getElementById('dark-theme-link').disabled).toBe(true)
            expect(localStorage.getItem('theme')).toBe('light')
        })

        it('ignora le preferenze di sistema (solo interazione utente)', () => {
            // Req 13.6: la preferenza non dipende da prefers-color-scheme
            // La funzione initDarkMode legge solo da localStorage, non da matchMedia
            localStorage.removeItem('theme')
            initDarkMode()
            // Senza preferenza salvata, resta in light mode indipendentemente dal sistema
            expect(document.body.classList.contains('dark')).toBe(false)
        })
    })
})
