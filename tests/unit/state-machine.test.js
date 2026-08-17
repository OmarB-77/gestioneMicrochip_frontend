import { describe, it, expect } from 'vitest'
import {
  STATI,
  VALID_TRANSITIONS,
  getStateIndex,
  isTransitionValid,
  getNextState,
  getPreviousState,
  canUserPerformTransition
} from '../../js/state-machine.js'

describe('state-machine', () => {
  describe('STATI', () => {
    it('contiene i 4 stati nell\'ordine corretto', () => {
      expect(STATI).toEqual(['disponibile', 'impiantato', 'adottato', 'registrato'])
    })

    it('è un array immutabile (frozen)', () => {
      expect(Object.isFrozen(STATI)).toBe(true)
    })
  })

  describe('VALID_TRANSITIONS', () => {
    it('mappa ogni stato al successore corretto', () => {
      expect(VALID_TRANSITIONS.disponibile).toBe('impiantato')
      expect(VALID_TRANSITIONS.impiantato).toBe('adottato')
      expect(VALID_TRANSITIONS.adottato).toBe('registrato')
      expect(VALID_TRANSITIONS.registrato).toBeNull()
    })

    it('è un oggetto immutabile (frozen)', () => {
      expect(Object.isFrozen(VALID_TRANSITIONS)).toBe(true)
    })
  })

  describe('getStateIndex', () => {
    it('restituisce l\'indice corretto per ogni stato', () => {
      expect(getStateIndex('disponibile')).toBe(0)
      expect(getStateIndex('impiantato')).toBe(1)
      expect(getStateIndex('adottato')).toBe(2)
      expect(getStateIndex('registrato')).toBe(3)
    })

    it('restituisce -1 per stati non validi', () => {
      expect(getStateIndex('invalido')).toBe(-1)
      expect(getStateIndex('')).toBe(-1)
      expect(getStateIndex(undefined)).toBe(-1)
      expect(getStateIndex(null)).toBe(-1)
    })
  })

  describe('isTransitionValid', () => {
    it('accetta transizioni sequenziali valide', () => {
      expect(isTransitionValid('disponibile', 'impiantato')).toBe(true)
      expect(isTransitionValid('impiantato', 'adottato')).toBe(true)
      expect(isTransitionValid('adottato', 'registrato')).toBe(true)
    })

    it('rifiuta transizioni all\'indietro', () => {
      expect(isTransitionValid('impiantato', 'disponibile')).toBe(false)
      expect(isTransitionValid('adottato', 'impiantato')).toBe(false)
      expect(isTransitionValid('registrato', 'adottato')).toBe(false)
      expect(isTransitionValid('registrato', 'disponibile')).toBe(false)
    })

    it('rifiuta salti di stato', () => {
      expect(isTransitionValid('disponibile', 'adottato')).toBe(false)
      expect(isTransitionValid('disponibile', 'registrato')).toBe(false)
      expect(isTransitionValid('impiantato', 'registrato')).toBe(false)
    })

    it('rifiuta transizione allo stesso stato', () => {
      expect(isTransitionValid('disponibile', 'disponibile')).toBe(false)
      expect(isTransitionValid('impiantato', 'impiantato')).toBe(false)
      expect(isTransitionValid('adottato', 'adottato')).toBe(false)
      expect(isTransitionValid('registrato', 'registrato')).toBe(false)
    })

    it('rifiuta stati non validi', () => {
      expect(isTransitionValid('invalido', 'impiantato')).toBe(false)
      expect(isTransitionValid('disponibile', 'invalido')).toBe(false)
      expect(isTransitionValid('', '')).toBe(false)
    })

    it('rifiuta transizione dall\'ultimo stato', () => {
      expect(isTransitionValid('registrato', 'registrato')).toBe(false)
    })
  })

  describe('getNextState', () => {
    it('restituisce lo stato successivo per ciascuno stato', () => {
      expect(getNextState('disponibile')).toBe('impiantato')
      expect(getNextState('impiantato')).toBe('adottato')
      expect(getNextState('adottato')).toBe('registrato')
    })

    it('restituisce null dall\'ultimo stato', () => {
      expect(getNextState('registrato')).toBeNull()
    })

    it('restituisce null per stati non validi', () => {
      expect(getNextState('invalido')).toBeNull()
      expect(getNextState('')).toBeNull()
    })
  })

  describe('getPreviousState', () => {
    it('restituisce lo stato precedente per ciascuno stato', () => {
      expect(getPreviousState('impiantato')).toBe('disponibile')
      expect(getPreviousState('adottato')).toBe('impiantato')
      expect(getPreviousState('registrato')).toBe('adottato')
    })

    it('restituisce null dal primo stato', () => {
      expect(getPreviousState('disponibile')).toBeNull()
    })

    it('restituisce null per stati non validi', () => {
      expect(getPreviousState('invalido')).toBeNull()
      expect(getPreviousState('')).toBeNull()
    })
  })

  describe('canUserPerformTransition', () => {
    describe('Admin', () => {
      it('può effettuare tutte le transizioni valide', () => {
        expect(canUserPerformTransition('admin', 'disponibile', 'impiantato')).toBe(true)
        expect(canUserPerformTransition('admin', 'impiantato', 'adottato')).toBe(true)
        expect(canUserPerformTransition('admin', 'adottato', 'registrato')).toBe(true)
      })

      it('non può effettuare transizioni non valide', () => {
        expect(canUserPerformTransition('admin', 'disponibile', 'adottato')).toBe(false)
        expect(canUserPerformTransition('admin', 'impiantato', 'disponibile')).toBe(false)
      })
    })

    describe('Guest', () => {
      it('può effettuare disponibile → impiantato', () => {
        expect(canUserPerformTransition('guest', 'disponibile', 'impiantato')).toBe(true)
      })

      it('può effettuare impiantato → adottato', () => {
        expect(canUserPerformTransition('guest', 'impiantato', 'adottato')).toBe(true)
      })

      it('NON può effettuare adottato → registrato (solo admin)', () => {
        expect(canUserPerformTransition('guest', 'adottato', 'registrato')).toBe(false)
      })

      it('non può effettuare transizioni non valide', () => {
        expect(canUserPerformTransition('guest', 'disponibile', 'adottato')).toBe(false)
        expect(canUserPerformTransition('guest', 'registrato', 'disponibile')).toBe(false)
      })
    })

    describe('Ruolo non riconosciuto', () => {
      it('non può effettuare alcuna transizione', () => {
        expect(canUserPerformTransition('unknown', 'disponibile', 'impiantato')).toBe(false)
        expect(canUserPerformTransition('', 'disponibile', 'impiantato')).toBe(false)
      })
    })
  })
})
