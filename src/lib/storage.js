/**
 * storage.js
 *
 * Drop-in replacement for the Claude artifact window.storage API.
 * Uses localStorage so the dashboard component works unchanged in production.
 *
 * API surface:
 *   storage.get(key)         → { key, value } | null
 *   storage.set(key, value)  → { key, value }
 *   storage.delete(key)      → { key, deleted: true }
 *   storage.list(prefix?)    → { keys: string[] }
 */

const PREFIX = 'sp:'   // namespace to avoid collisions

function fullKey(key) { return PREFIX + key }

export const storage = {
  async get(key) {
    try {
      const val = localStorage.getItem(fullKey(key))
      if (val === null) return null
      return { key, value: val }
    } catch {
      return null
    }
  },

  async set(key, value) {
    try {
      localStorage.setItem(fullKey(key), value)
      return { key, value }
    } catch {
      return null
    }
  },

  async delete(key) {
    try {
      localStorage.removeItem(fullKey(key))
      return { key, deleted: true }
    } catch {
      return null
    }
  },

  async list(prefix = '') {
    try {
      const keys = Object.keys(localStorage)
        .filter(k => k.startsWith(PREFIX + prefix))
        .map(k => k.slice(PREFIX.length))
      return { keys }
    } catch {
      return { keys: [] }
    }
  },
}

// Expose globally so the dashboard component can call window.storage.*
if (typeof window !== 'undefined') {
  window.storage = storage
}
