// The note library: which notes exist, which one is open, and the route between them.
// Notes are stored one per key as their text format, with a small index beside them.
import { create } from 'zustand'
import { isDemo } from './demo'
import {
  INDEX_KEY, type Entry, addEntry, duplicateTitle, findEntry, neighborAfterRemoval, newId, noteKey, parseIndex, removeEntry, serializeIndex, sortEntries, touch,
} from './model/library'
import { parseNote, serializeNote } from './model/format'
import { SIDEBAR_QUERY } from './hooks'
import { makeBackup, parseBackup } from './model/settings'
import { STARTER } from './model/starter'
import { kv } from './storage'
import { flushSave, loadNote, onSaved, useStore } from './store'

const LEGACY_KEY = 'euclidnote:note'

const BLANK = 'title: Untitled\ncolumns: [1fr, 1fr]\n'

interface LibraryState {
  entries: Entry[]
  // The open note; null shows the list (on phones).
  activeId: string | null
  // A note waiting for the user to confirm its deletion.
  pendingDelete: string | null
  // The sidebar can be tucked away on big screens.
  sidebarHidden: boolean
}
const SIDEBAR_KEY = 'euclidnote:sidebar-hidden'
const readHidden = () => {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1'
  } catch {
    return false
  }
}
export const useLibrary = create<LibraryState>()(() => ({ entries: [], activeId: null, pendingDelete: null, sidebarHidden: readHidden() }))
export const setSidebarHidden = (hidden: boolean) => {
  localStorage.setItem(SIDEBAR_KEY, hidden ? '1' : '0')
  useLibrary.setState({ sidebarHidden: hidden })
}
export const askDelete = (id: string | null) => useLibrary.setState({ pendingDelete: id })

const readSource = (id: string) => kv.get(noteKey(id))
const writeIndex = (entries: Entry[]) => kv.set(INDEX_KEY, serializeIndex(entries))
const setEntries = (entries: Entry[]) => {
  writeIndex(entries)
  useLibrary.setState({ entries })
}
const titleOf = (source: string) => {
  try {
    return parseNote(source).title
  } catch {
    return 'Untitled'
  }
}

// ---- the route: #/ is the list, #/<id> is a note ----

const routeId = () => {
  const m = /^#\/([\w-]+)/.exec(location.hash)
  return m ? m[1] : null
}
export const go = (id: string | null, replace = false) => {
  const hash = id ? `#/${id}` : '#/'
  if (replace) history.replaceState(null, '', hash)
  else location.hash = hash
  sync()
}

// Make the open note match the route.
function sync() {
  const { entries, activeId } = useLibrary.getState()
  const want = routeId()
  const id = findEntry(entries, want) ? want : null
  if (id === activeId) return
  flushSave()
  if (id) {
    const source = readSource(id)
    loadNote(source ?? BLANK, noteKey(id))
  } else {
    loadNote(STARTER, null)
  }
  useLibrary.setState({ activeId: id })
}

// ---- actions ----

export function createNote(): string {
  const { entries } = useLibrary.getState()
  const id = newId(entries)
  kv.set(noteKey(id), BLANK)
  setEntries(addEntry(entries, { id, title: 'Untitled', updated: Date.now() }))
  go(id)
  // A new note is for filling in.
  useStore.getState().setMode('edit')
  return id
}

export function duplicateNote(id: string): string | null {
  flushSave()
  const source = readSource(id)
  const { entries } = useLibrary.getState()
  const from = findEntry(entries, id)
  if (source === null || !from) return null
  const copy = newId(entries)
  const title = duplicateTitle(from.title)
  // The copy carries the new title inside, so the two stay distinguishable.
  let text = source
  try {
    text = serializeNote({ ...parseNote(source), title })
  } catch {
    // A note this version cannot read is copied as it is.
  }
  kv.set(noteKey(copy), text)
  setEntries(addEntry(entries, { id: copy, title, updated: Date.now() }))
  return copy
}

export function deleteNote(id: string) {
  flushSave()
  useLibrary.setState({ pendingDelete: null })
  const { entries, activeId } = useLibrary.getState()
  const next = neighborAfterRemoval(entries, id)
  kv.remove(noteKey(id))
  setEntries(removeEntry(entries, id))
  if (activeId === id) {
    // On wide screens another note opens; on phones the list shows. Either way the route moves off the deleted note.
    go(wideSidebar() ? next : null, true)
  }
}

const wideSidebar = () => typeof matchMedia !== 'undefined' && matchMedia(SIDEBAR_QUERY).matches

export const sourceOf = (id: string) => readSource(id)

// ---- startup ----

export function initLibrary() {
  if (isDemo()) return
  let entries = parseIndex(kv.get(INDEX_KEY))
  // Drop entries whose note is gone, and adopt the single-note storage of older versions.
  entries = entries.filter((e) => readSource(e.id) !== null)
  const legacy = kv.get(LEGACY_KEY)
  // The first run starts with the starter note. Once there is an index, an empty library stays empty.
  if (entries.length === 0 && kv.get(INDEX_KEY) === null) {
    const id = newId(entries)
    const source = legacy ?? STARTER
    kv.set(noteKey(id), source)
    entries = [{ id, title: titleOf(source), updated: Date.now() }]
  }
  if (legacy !== null) kv.remove(LEGACY_KEY)
  entries = sortEntries(entries)
  writeIndex(entries)
  useLibrary.setState({ entries, activeId: null })
  // Keep the list's titles and order current as the open note is edited.
  onSaved((note) => {
    const { entries: now, activeId } = useLibrary.getState()
    if (activeId) setEntries(touch(now, activeId, note.title, Date.now()))
  })
  window.addEventListener('hashchange', sync)
  // Tests and older links land here with a note id, or with nothing.
  const want = routeId()
  if (want && findEntry(entries, want)) sync()
  else if (matchMedia(SIDEBAR_QUERY).matches) go(entries[0].id, true)
}

// ---- backups ----

// Every note, in one file.
export function exportAll(): string {
  flushSave()
  const { entries } = useLibrary.getState()
  const notes = entries.flatMap((e) => {
    const source = readSource(e.id)
    return source === null ? [] : [{ title: e.title, updated: e.updated, source }]
  })
  return makeBackup(notes, Date.now())
}

const readable = (source: string) => {
  try {
    parseNote(source)
    return true
  } catch {
    return false
  }
}

// Adds the notes in a backup as new notes (nothing is overwritten). Throws BackupError for a file that is not one.
export function importBackup(text: string): { added: number; skipped: number } {
  const { notes, skipped } = parseBackup(text, readable)
  let entries = useLibrary.getState().entries
  const now = Date.now()
  for (const n of notes) {
    const id = newId(entries)
    kv.set(noteKey(id), n.source)
    entries = addEntry(entries, { id, title: titleOf(n.source), updated: n.updated || now })
  }
  setEntries(entries)
  return { added: notes.length, skipped }
}

export function deleteAllNotes() {
  flushSave()
  for (const e of useLibrary.getState().entries) kv.remove(noteKey(e.id))
  setEntries([])
  go(null, true)
}
