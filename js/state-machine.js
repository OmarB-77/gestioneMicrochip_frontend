/**
 * State Machine — Gestione ciclo di vita microchip
 *
 * Impone una progressione sequenziale e irreversibile:
 * disponibile → impiantato → adottato → registrato
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

/** I 4 stati in ordine sequenziale (array immutabile) */
export const STATI = Object.freeze(['disponibile', 'impiantato', 'adottato', 'registrato'])

/** Mappa delle transizioni valide: stato_corrente → stato_target */
export const VALID_TRANSITIONS = Object.freeze({
  disponibile: 'impiantato',
  impiantato: 'adottato',
  adottato: 'registrato',
  registrato: null
})

/**
 * Restituisce l'indice di uno stato nella sequenza.
 * @param {string} state
 * @returns {number} indice (0-based) o -1 se stato non valido
 */
export function getStateIndex(state) {
  return STATI.indexOf(state)
}

/**
 * Verifica se una transizione di stato è valida.
 * Una transizione è valida SOLO se targetState è l'immediato successore di currentState.
 * @param {string} currentState
 * @param {string} targetState
 * @returns {boolean}
 */
export function isTransitionValid(currentState, targetState) {
  const currentIdx = getStateIndex(currentState)
  const targetIdx = getStateIndex(targetState)

  // Stato non riconosciuto
  if (currentIdx === -1 || targetIdx === -1) return false

  // Valida solo se il target è esattamente il prossimo nella sequenza
  return targetIdx === currentIdx + 1
}

/**
 * Restituisce lo stato successivo nella sequenza.
 * @param {string} currentState
 * @returns {string|null} stato successivo, o null se già all'ultimo stato
 */
export function getNextState(currentState) {
  const idx = getStateIndex(currentState)
  if (idx === -1 || idx >= STATI.length - 1) return null
  return STATI[idx + 1]
}

/**
 * Restituisce lo stato precedente nella sequenza.
 * @param {string} currentState
 * @returns {string|null} stato precedente, o null se al primo stato
 */
export function getPreviousState(currentState) {
  const idx = getStateIndex(currentState)
  if (idx <= 0) return null
  return STATI[idx - 1]
}

/**
 * Verifica se un utente con un dato ruolo può effettuare una specifica transizione.
 *
 * - Admin: può effettuare qualsiasi transizione valida
 * - Guest: può effettuare disponibile→impiantato e impiantato→adottato
 * - Guest NON può effettuare adottato→registrato (riservato all'admin)
 *
 * @param {string} role - 'admin' | 'guest'
 * @param {string} fromState
 * @param {string} toState
 * @returns {boolean}
 */
export function canUserPerformTransition(role, fromState, toState) {
  // La transizione deve essere valida in primo luogo
  if (!isTransitionValid(fromState, toState)) return false

  // Admin può fare tutto
  if (role === 'admin') return true

  // Guest può fare solo disponibile→impiantato e impiantato→adottato
  if (role === 'guest') {
    return (
      (fromState === 'disponibile' && toState === 'impiantato') ||
      (fromState === 'impiantato' && toState === 'adottato')
    )
  }

  // Ruolo non riconosciuto
  return false
}
