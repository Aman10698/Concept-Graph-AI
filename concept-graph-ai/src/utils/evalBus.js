/**
 * evalBus.js
 *
 * The native `storage` event only fires in OTHER tabs, not the writing tab.
 * This tiny utility lets any part of the app broadcast evaluation/topics updates
 * within the SAME tab via a custom DOM event, while still writing to localStorage.
 *
 * Usage:
 *   import { setEvalStorage, onEvalChange, offEvalChange } from '../utils/evalBus'
 *
 *   // Writer:
 *   setEvalStorage('learningEvaluationData', JSON.stringify(merged))
 *
 *   // Listener:
 *   const handler = () => reloadFromStorage()
 *   onEvalChange(handler)
 *   return () => offEvalChange(handler)
 */

const EVENT_NAME = 'conceptgraph:evalChanged'

/**
 * Write to localStorage AND dispatch an in-page event so same-tab listeners wake up.
 */
export function setEvalStorage(key, value) {
  localStorage.setItem(key, value)
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { key } }))
}

/** Subscribe to evaluation-data changes (same-tab or cross-tab). */
export function onEvalChange(handler) {
  window.addEventListener(EVENT_NAME, handler)
  window.addEventListener('storage', handler)
}

/** Unsubscribe. */
export function offEvalChange(handler) {
  window.removeEventListener(EVENT_NAME, handler)
  window.removeEventListener('storage', handler)
}
