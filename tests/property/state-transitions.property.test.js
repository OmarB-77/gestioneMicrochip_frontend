/**
 * Property-Based Test: Progressione sequenziale degli stati
 *
 * Feature: gestione-microchip, Property 3: Progressione sequenziale degli stati
 * Validates: Requirements 9.1, 9.2, 9.3
 *
 * Per qualsiasi chip nel sistema, una transizione di stato è accettata se e solo se
 * lo stato target è l'immediato successore dello stato corrente nella sequenza
 * disponibile → impiantato → adottato → registrato.
 * Qualsiasi altra transizione (salto in avanti, all'indietro, o a sé stesso come
 * cambio di stato) SHALL essere rifiutata.
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  STATI,
  isTransitionValid,
  getStateIndex,
  canUserPerformTransition
} from '../../js/state-machine.js'

const PBT_CONFIG = { numRuns: 100 }

describe('Property 3: Progressione sequenziale degli stati', () => {
  /**
   * **Validates: Requirements 9.1**
   *
   * Per qualsiasi coppia di stati (currentState, targetState), isTransitionValid
   * restituisce true SOLO se targetState è l'immediato successore di currentState.
   */
  it('isTransitionValid accetta solo transizioni immediatamente successive', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STATI),
        fc.constantFrom(...STATI),
        (currentState, targetState) => {
          const currentIdx = getStateIndex(currentState)
          const targetIdx = getStateIndex(targetState)
          const isImmediateSuccessor = targetIdx === currentIdx + 1

          expect(isTransitionValid(currentState, targetState)).toBe(isImmediateSuccessor)
        }
      ),
      PBT_CONFIG
    )
  })

  /**
   * **Validates: Requirements 9.2**
   *
   * Per qualsiasi stato, le transizioni all'indietro sono sempre rifiutate.
   */
  it('le transizioni all\'indietro sono sempre rifiutate', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STATI),
        fc.constantFrom(...STATI),
        (currentState, targetState) => {
          const currentIdx = getStateIndex(currentState)
          const targetIdx = getStateIndex(targetState)

          // Consideriamo solo coppie dove target è strettamente prima di current
          fc.pre(targetIdx < currentIdx)

          expect(isTransitionValid(currentState, targetState)).toBe(false)
        }
      ),
      PBT_CONFIG
    )
  })

  /**
   * **Validates: Requirements 9.3**
   *
   * Per qualsiasi stato, saltare stati (avanzamento di più di 1 posizione) è sempre rifiutato.
   */
  it('saltare stati (avanzamento > 1) è sempre rifiutato', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STATI),
        fc.constantFrom(...STATI),
        (currentState, targetState) => {
          const currentIdx = getStateIndex(currentState)
          const targetIdx = getStateIndex(targetState)

          // Consideriamo solo coppie dove il salto è > 1
          fc.pre(targetIdx - currentIdx > 1)

          expect(isTransitionValid(currentState, targetState)).toBe(false)
        }
      ),
      PBT_CONFIG
    )
  })

  /**
   * **Validates: Requirements 9.1**
   *
   * Per qualsiasi transizione valida, l'indice dello stato aumenta esattamente di 1.
   */
  it('per ogni transizione valida, l\'indice dello stato aumenta esattamente di 1', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STATI),
        fc.constantFrom(...STATI),
        (currentState, targetState) => {
          if (isTransitionValid(currentState, targetState)) {
            const currentIdx = getStateIndex(currentState)
            const targetIdx = getStateIndex(targetState)
            expect(targetIdx - currentIdx).toBe(1)
          }
        }
      ),
      PBT_CONFIG
    )
  })

  /**
   * **Validates: Requirements 9.2**
   *
   * Per qualsiasi stringa arbitraria non riconosciuta come stato valido,
   * isTransitionValid rifiuta la transizione.
   */
  it('stati non validi (stringhe arbitrarie) vengono sempre rifiutati', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.constantFrom(...STATI),
        (arbitraryString, validState) => {
          // Escludiamo il caso in cui la stringa arbitraria sia uno stato valido
          fc.pre(!STATI.includes(arbitraryString))

          expect(isTransitionValid(arbitraryString, validState)).toBe(false)
          expect(isTransitionValid(validState, arbitraryString)).toBe(false)
        }
      ),
      PBT_CONFIG
    )
  })

  /**
   * **Validates: Requirements 9.1, 9.2, 9.3**
   *
   * La transizione dallo stesso stato a sé stesso è sempre rifiutata (non è un avanzamento).
   */
  it('la transizione da uno stato a sé stesso è sempre rifiutata', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STATI),
        (state) => {
          expect(isTransitionValid(state, state)).toBe(false)
        }
      ),
      PBT_CONFIG
    )
  })

  /**
   * **Validates: Requirements 9.1**
   *
   * Admin può effettuare qualsiasi transizione valida; Guest non può effettuare
   * adottato → registrato.
   */
  it('canUserPerformTransition rispetta i permessi di ruolo per transizioni valide', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('admin', 'guest'),
        fc.constantFrom(...STATI),
        fc.constantFrom(...STATI),
        (role, currentState, targetState) => {
          const result = canUserPerformTransition(role, currentState, targetState)

          if (!isTransitionValid(currentState, targetState)) {
            // Se la transizione non è valida, nessun ruolo può eseguirla
            expect(result).toBe(false)
          } else if (role === 'admin') {
            // Admin può fare qualsiasi transizione valida
            expect(result).toBe(true)
          } else if (role === 'guest') {
            // Guest può fare disponibile→impiantato e impiantato→adottato
            // ma NON adottato→registrato
            if (currentState === 'adottato' && targetState === 'registrato') {
              expect(result).toBe(false)
            } else {
              expect(result).toBe(true)
            }
          }
        }
      ),
      PBT_CONFIG
    )
  })
})
