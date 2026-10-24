import { useEffect, useMemo, useRef, useState } from 'react'
import { askDelete, createNote, deleteNote, duplicateNote, go, setSidebarHidden, sourceOf, useLibrary } from '../library'
import { parseNote } from '../model/format'
import { type Entry, relativeTime, sketch } from '../model/library'
import type { Note } from '../model/types'
import { useInstallPrompt } from '../hooks'
import { openSettings } from '../settings'
import { BackIcon, DuplicateIcon, GearIcon, MoreIcon, PlusIcon, SidebarIcon, TrashIcon } from './icons'

// The list of notes: a page of cards on phones and tablets, a sidebar of rows beside the note on big screens.

function useNoteOf(entry: Entry): Note | null {
  return useMemo(() => {
    const source = sourceOf(entry.id)
    try {
      return source ? parseNote(source) : null
    } catch {
      return null
    }
    // The note changes exactly when its entry's time does.
  }, [entry.id, entry.updated])
}

// The essence of a note: a few big regions of its main colors, filling a square (see sketch in model/library).
// The regions meet edge to edge; a stroke the color of the backdrop leaves the gaps between them.
export function Thumb({ note }: { note: Note | null }) {
  if (!note) return <div className="thumb" />
  const { width, height, blocks } = sketch(note)
  return (
    <svg className="thumb" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      {blocks.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          rx={4}
          stroke="var(--thumb-bg)"
          strokeWidth={1.8}
          style={b.fill ? { fill: `var(--c-${b.fill})` } : { fill: 'var(--text-3)', opacity: 0.3 }}
        />
      ))}
    </svg>
  )
}

// Duplicate and delete. Deleting asks first, in a dialog.
function EntryMenu({ entry, onClose, onDuplicated }: { entry: Entry; onClose: () => void; onDuplicated?: (id: string) => void }) {
  const ref = useRef<HTMLUListElement>(null)
  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest('.note-more')) onClose()
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [onClose])
  return (
    <ul className="menu note-menu" ref={ref} role="menu" data-testid={`note-menu-list-${entry.id}`}>
      <li>
        <button
          data-testid={`note-duplicate-${entry.id}`}
          onClick={() => {
            const id = duplicateNote(entry.id)
            if (id) onDuplicated?.(id)
            onClose()
          }}
        >
          <DuplicateIcon size={18} /> Duplicate
        </button>
      </li>
      <li>
        <button
          data-testid={`note-delete-${entry.id}`}
          data-danger="true"
          onClick={() => {
            onClose()
            askDelete(entry.id)
          }}
        >
          <TrashIcon size={18} /> Delete…
        </button>
      </li>
    </ul>
  )
}

function Card({ entry, active, now }: { entry: Entry; active: boolean; now: number }) {
  const note = useNoteOf(entry)
  const [menu, setMenu] = useState(false)
  return (
    <article className="note-card" data-testid={`note-card-${entry.id}`} data-active={active}>
      <button className="note-open" data-testid={`note-open-${entry.id}`} onClick={() => go(entry.id)}>
        <Thumb note={note} />
        <strong className="note-title">{entry.title || 'Untitled'}</strong>
        <span className="note-when">{relativeTime(entry.updated, now)}</span>
      </button>
      <button className="note-more" data-testid={`note-menu-${entry.id}`} aria-label="Note options" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
        <MoreIcon size={20} />
      </button>
      {menu && <EntryMenu entry={entry} onClose={() => setMenu(false)} />}
    </article>
  )
}

function Row({ entry, active, now }: { entry: Entry; active: boolean; now: number }) {
  const note = useNoteOf(entry)
  const [menu, setMenu] = useState(false)
  return (
    <li className="note-row" data-testid={`note-card-${entry.id}`} data-active={active}>
      <button className="note-open" data-testid={`note-open-${entry.id}`} onClick={() => go(entry.id)}>
        <Thumb note={note} />
        <span className="note-text">
          <strong className="note-title">{entry.title || 'Untitled'}</strong>
          <span className="note-when">{relativeTime(entry.updated, now)}</span>
        </span>
      </button>
      <button className="note-more" data-testid={`note-menu-${entry.id}`} aria-label="Note options" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
        <MoreIcon size={18} />
      </button>
      {menu && <EntryMenu entry={entry} onClose={() => setMenu(false)} />}
    </li>
  )
}

// Re-render now and then so "5 min ago" stays true.
function useClock() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now
}

// The home page on phones and tablets.
export function Home() {
  const entries = useLibrary((s) => s.entries)
  const now = useClock()
  const install = useInstallPrompt()
  return (
    <div className="app home" data-testid="home">
      <header className="topbar">
        <h1 data-testid="home-title">Notes</h1>
        {install && (
          <button className="header-btn" data-testid="install" onClick={install.install}>
            Install
          </button>
        )}
        <button className="icon-btn gear" data-testid="settings-open" aria-label="Settings" onClick={() => openSettings()}>
          <GearIcon size={22} />
        </button>
        <button className="header-btn add-note" data-testid="note-new" onClick={createNote}>
          <PlusIcon size={16} /> New
        </button>
      </header>
      <main className="home-scroll" data-testid="scroll">
        {entries.length === 0 ? (
          <EmptyNotes />
        ) : (
          <div className="note-grid">
            {entries.map((e) => (
              <Card key={e.id} entry={e} active={false} now={now} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// The list beside the note on big screens.
export function Sidebar() {
  const entries = useLibrary((s) => s.entries)
  const activeId = useLibrary((s) => s.activeId)
  const now = useClock()
  return (
    <aside className="sidebar" data-testid="sidebar" aria-label="Notes">
      <header className="side-head">
        <h2>Notes</h2>
        <span className="side-tools">
          <button className="icon-btn" data-testid="note-new" aria-label="New note" onClick={createNote}>
            <PlusIcon size={22} />
          </button>
          <button className="icon-btn gear" data-testid="settings-open" aria-label="Settings" onClick={() => openSettings()}>
            <GearIcon size={20} />
          </button>
          <HideSidebarButton />
        </span>
      </header>
      <ul className="side-list">
        {entries.map((e) => (
          <Row key={e.id} entry={e} active={e.id === activeId} now={now} />
        ))}
      </ul>
    </aside>
  )
}

// The way back to the list, in a note's header (phones and tablets).
export function BackButton() {
  return (
    <button className="icon-btn back-btn" data-testid="back" aria-label="All notes" onClick={() => go(null)}>
      <BackIcon size={24} />
    </button>
  )
}

// Shown in the middle of the page when there is nothing to look at.
export function EmptyNotes({ text = 'No notes yet.' }: { text?: string }) {
  return (
    <div className="home-empty" data-testid="home-empty">
      <p>{text}</p>
      <button className="big-btn" data-testid="empty-new" onClick={createNote}>
        <PlusIcon size={20} /> New note
      </button>
    </div>
  )
}

// Asks before a note is deleted.
export function DeleteDialog() {
  const id = useLibrary((s) => s.pendingDelete)
  const entry = useLibrary((s) => s.entries.find((e) => e.id === id))
  useEffect(() => {
    if (!id) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && askDelete(null)
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [id])
  if (!id || !entry) return null
  return (
    <div className="scrim" data-testid="delete-scrim" onPointerDown={(e) => e.target === e.currentTarget && askDelete(null)}>
      <div className="modal" role="alertdialog" aria-label="Delete note" data-testid="delete-dialog">
        <h2>Delete “{entry.title || 'Untitled'}”?</h2>
        <p>The note and everything in it will be gone. This can’t be undone.</p>
        <div className="modal-actions">
          <button data-testid="delete-cancel" onClick={() => askDelete(null)}>Cancel</button>
          <button data-testid="delete-confirm" data-danger="true" onClick={() => deleteNote(id)}>Delete</button>
        </div>
      </div>
    </div>
  )
}

// Tuck the sidebar away, or bring it back from the note's header.
export function HideSidebarButton() {
  return (
    <button className="icon-btn" data-testid="sidebar-hide" aria-label="Hide sidebar" onClick={() => setSidebarHidden(true)}>
      <SidebarIcon size={22} />
    </button>
  )
}
export function ShowSidebarButton() {
  return (
    <button className="icon-btn show-sidebar" data-testid="sidebar-show" aria-label="Show sidebar" onClick={() => setSidebarHidden(false)}>
      <SidebarIcon size={22} />
    </button>
  )
}
