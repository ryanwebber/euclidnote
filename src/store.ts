import { create } from 'zustand'
import { parseNote, serializeNote } from './model/format'
import { type History, emptyHistory, record, redo, undo } from './model/history'
import { getCell } from './model/ops'
import type { CellRef, Note, Selection } from './model/types'

import { initialSource, isDemo, storageKey } from './demo'
import { kv } from './storage'

// Where the open note is saved. The demo route has its own; otherwise the library sets it when a note is opened.
let activeKey: string | null = isDemo() ? storageKey() : null

export type Mode = 'view' | 'edit'

export type PopId = 'add' | 'look' | 'format' | 'fill' | 'widget' | 'layout' | 'column'
// A sheet is a big centered panel; a menu hangs off the thing you tapped.
export interface Popover {
  id: PopId
  x: number
  y: number
  placement: 'above' | 'below'
  // The column a column menu is about.
  index?: number
}

interface State {
  note: Note
  mode: Mode
  selected: Selection | null
  // The text cell whose text is being typed into, if any.
  editing: CellRef | null
  popover: Popover | null
  // Set when the open note could not be read. It is left untouched in storage and edits are not saved.
  problem: string | null
  history: History
  setMode: (mode: Mode) => void
  select: (selection: Selection | null) => void
  startEditing: (ref: CellRef) => void
  stopEditing: () => void
  openPopover: (p: Popover) => void
  closePopover: () => void
  // An edit that can be undone. Edits sharing a `key` close together fold into one step.
  edit: (fn: (note: Note) => Note, key?: string) => void
  // Using a widget (tapping a counter, starting a timer): saved, but not an undo step.
  interact: (fn: (note: Note) => Note) => void
  undo: () => void
  redo: () => void
}

// Until storage is open (see initStore) the page holds a placeholder: the sample note on /demo, else the starter.
const placeholder = () => parseNote(initialSource())

export const sameRef = (a: CellRef, b: CellRef) =>
  a.in === 'loose'
    ? b.in === 'loose' && a.i === b.i
    : b.in === 'group' && a.g === b.g && a.r === b.r && a.c === b.c

// A selection or text-edit is dropped if what it pointed at no longer exists.
const keep = (note: Note, s: Selection | null) =>
  s && (s.kind === 'group' ? !!note.groups[s.g] : getCell(note, s.ref) !== undefined) ? s : null
const keepRef = (note: Note, ref: CellRef | null) => (ref && getCell(note, ref) ? ref : null)

export const useStore = create<State>()((set) => ({
  note: placeholder(),
  mode: 'view',
  selected: null,
  editing: null,
  popover: null,
  problem: null,
  history: emptyHistory(),
  setMode: (mode) => set({ mode, selected: null, editing: null, popover: null }),
  openPopover: (popover) => set({ popover }),
  closePopover: () => set({ popover: null }),
  select: (selected) =>
    set((s) => ({
      selected,
      popover: null,
      editing: selected?.kind === 'cell' && s.editing && sameRef(selected.ref, s.editing) ? s.editing : null,
    })),
  startEditing: (ref) => set({ editing: ref, selected: { kind: 'cell', ref }, popover: null }),
  stopEditing: () => set({ editing: null }),
  edit: (fn, key) =>
    set((s) => {
      const note = fn(s.note)
      if (note === s.note) return s
      return {
        note,
        history: record(s.history, s.note, Date.now(), key),
        selected: keep(note, s.selected),
        editing: keepRef(note, s.editing),
      }
    }),
  interact: (fn) => set((s) => ({ note: fn(s.note) })),
  undo: () =>
    set((s) => {
      const r = undo(s.history, s.note)
      return r ? { note: r.note, history: r.history, selected: keep(r.note, s.selected), editing: null } : s
    }),
  redo: () =>
    set((s) => {
      const r = redo(s.history, s.note)
      return r ? { note: r.note, history: r.history, selected: keep(r.note, s.selected), editing: null } : s
    }),
}))

// The note is persisted as its text format, the same thing we hand-author. Writes are
// batched: a drag or a stream of keystrokes saves once it settles, not on every change.
let saveTimer: ReturnType<typeof setTimeout> | undefined
let saveHook: ((note: Note) => void) | undefined
// The library hears about every save, to keep its list (titles, order) current.
export const onSaved = (fn: (note: Note) => void) => {
  saveHook = fn
}
const save = () => {
  clearTimeout(saveTimer)
  saveTimer = undefined
  if (!activeKey) return
  const { note } = useStore.getState()
  kv.set(activeKey, serializeNote(note))
  saveHook?.(note)
}
export const flushSave = () => saveTimer !== undefined && save()

// Switch the editor to another note. Anything pending is saved first; history, mode and selection start fresh.
export function loadNote(source: string, key: string | null) {
  flushSave()
  clearTimeout(saveTimer)
  saveTimer = undefined
  let note: Note
  let problem: string | null = null
  try {
    note = parseNote(source)
    activeKey = key
  } catch (e) {
    // Never save over a note we could not read: show a blank page, and keep the stored text as it is.
    note = parseNote('title: Can’t open this note\n')
    problem = e instanceof Error ? e.message : 'This note could not be read.'
    activeKey = null
  }
  useStore.setState({ note, mode: 'view', selected: null, editing: null, popover: null, problem, history: emptyHistory() })
  // Opening a note is not an edit: do not let the subscription below save it (and bump its time).
  clearTimeout(saveTimer)
  saveTimer = undefined
}
useStore.subscribe((s, prev) => {
  if (s.note === prev.note) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(save, 150)
})
// Never lose the last edit when the page goes away.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => saveTimer !== undefined && save())
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && saveTimer !== undefined && save())
}

// The demo route keeps its note in storage under its own key. Call once storage has opened.
export function initStore() {
  if (isDemo()) loadNote(kv.get(storageKey()) ?? initialSource(), storageKey())
}
