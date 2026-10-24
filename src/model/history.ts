// Undo / redo as a pure data structure. Typing and dragging produce bursts of edits;
// edits sharing a `key` within COALESCE_MS fold into one undo step.
import type { Note } from './types'

export const COALESCE_MS = 800
const LIMIT = 100

export interface History {
  past: Note[]
  future: Note[]
  key?: string
  at?: number
}

export const emptyHistory = (): History => ({ past: [], future: [] })

// Record that `prev` is being replaced by a new note.
export function record(h: History, prev: Note, now: number, key?: string): History {
  if (key !== undefined && key === h.key && h.at !== undefined && now - h.at < COALESCE_MS) {
    return { ...h, at: now }
  }
  return { past: [...h.past, prev].slice(-LIMIT), future: [], key, at: now }
}

export function undo(h: History, present: Note): { note: Note; history: History } | null {
  const prev = h.past[h.past.length - 1]
  if (!prev) return null
  return { note: prev, history: { past: h.past.slice(0, -1), future: [present, ...h.future] } }
}

export function redo(h: History, present: Note): { note: Note; history: History } | null {
  const next = h.future[0]
  if (!next) return null
  return { note: next, history: { past: [...h.past, present], future: h.future.slice(1) } }
}
