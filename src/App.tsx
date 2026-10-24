import { useEffect, useRef } from 'react'
import { DemoBar } from './components/DemoBar'
import { SettingsSheet } from './components/Settings'
import { BackButton, DeleteDialog, EmptyNotes, Home, ShowSidebarButton, Sidebar } from './components/Library'
import { Dock } from './components/Dock'
import { Grid } from './components/Grid'
import { Inspector } from './components/Inspector'
import { RedoIcon, UndoIcon } from './components/icons'
import { Popovers } from './components/Popovers'
import { isDemo } from './demo'
import { useKeyboardInset, useSidebar, useWide } from './hooks'
import { go, useLibrary } from './library'
import { setTitle } from './model/ops'
import { useShortcuts } from './shortcuts'
import { useStore } from './store'

export function NoteScreen({ back = false, showSidebar = false }: { back?: boolean; showSidebar?: boolean }) {
  useKeyboardInset()
  useShortcuts()
  const wide = useWide()
  const scroll = useRef<HTMLElement>(null)
  const title = useStore((s) => s.note.title)
  const flow = useStore((s) => s.note.flow)
  const mode = useStore((s) => s.mode)
  const problem = useStore((s) => s.problem)
  const empty = useStore((s) => s.note.cells.length === 0 && s.note.groups.length === 0)
  const selectedKey = useStore((s) => JSON.stringify(s.selected))
  const canUndo = useStore((s) => s.history.past.length > 0)
  const canRedo = useStore((s) => s.history.future.length > 0)
  const { edit, select, stopEditing, setMode, undo, redo } = useStore.getState()
  const editing = mode === 'edit'

  // Right-flow notes fade at an edge when there is more content past it.
  const noteKey = useStore((s) => s.note)
  useEffect(() => {
    const el = scroll.current
    if (!el) return
    const update = () => {
      const right = flow === 'right'
      el.dataset.fadeStart = String(right && el.scrollLeft > 2)
      el.dataset.fadeEnd = String(right && el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [flow, noteKey])

  // Keep what you just selected or added in view.
  useEffect(() => {
    // Only chase a selection that fits on screen; a group wider than the screen should not make the view jump.
    const sel = document.querySelector<HTMLElement>('[data-testid="selection"]')
    const box = scroll.current?.getBoundingClientRect()
    if (!sel || !box) return
    const r = sel.getBoundingClientRect()
    if (r.width <= box.width && r.height <= box.height - 120) sel.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [selectedKey])

  return (
    <div className="app" data-mode={mode} data-flow={flow} data-demo={isDemo()} data-wide={wide}>
      {isDemo() && <DemoBar />}
      <header className="topbar">
        {back && <BackButton />}
        {showSidebar && <ShowSidebarButton />}
        {editing ? (
          <input
            className="title-input"
            data-testid="title-input"
            aria-label="Note title"
            value={title}
            onChange={(e) => edit((n) => setTitle(n, e.target.value), 'title')}
          />
        ) : (
          <h1 data-testid="title">{title}</h1>
        )}
        {/* On large screens undo and redo live up here, since there is no dock. */}
        {editing && wide && (
          <div className="head-tools">
            <button className="icon-btn" data-testid="undo" aria-label="Undo" disabled={!canUndo} onClick={undo}><UndoIcon /></button>
            <button className="icon-btn" data-testid="redo" aria-label="Redo" disabled={!canRedo} onClick={redo}><RedoIcon /></button>
          </div>
        )}
        <button className="header-btn" data-testid="mode-toggle" data-editing={editing} onClick={() => setMode(editing ? 'view' : 'edit')}>
          {editing ? 'Done' : 'Edit'}
        </button>
      </header>
      {problem && (
        <p className="problem" role="alert" data-testid="problem">
          {problem} The note is kept as it is, and nothing you do on this page is saved.
        </p>
      )}
      <div className="body">
        <main
          className="scroll"
          ref={scroll}
          data-testid="scroll"
          onClick={(e) => {
            // A tap on bare canvas clears the selection.
            if (editing && !(e.target as HTMLElement).closest('.cell, .handle, .sel, .gframe, .ruler, .slot')) {
              select(null)
              stopEditing()
            }
          }}
        >
          <div className="canvas">
            <Grid scrollRef={scroll} />
          </div>
          {empty && !editing && (
            <p className="empty-note" data-testid="empty-note">
              Nothing here yet.
              <br />
              Tap Edit to start.
            </p>
          )}
        </main>
        {editing && wide && <Inspector />}
      </div>
      {editing && !wide && <Dock />}
      <Popovers wide={wide} />
    </div>
  )
}

// Phones and tablets show the list of notes, or one note with a way back. Big screens keep the list beside the note.
export function App() {
  const sidebar = useSidebar()
  const activeId = useLibrary((s) => s.activeId)
  const first = useLibrary((s) => s.entries[0]?.id ?? null)
  const hidden = useLibrary((s) => s.sidebarHidden)
  // With the list always on screen, a note is always open (when there is one).
  useEffect(() => {
    if (!isDemo() && sidebar && !activeId && first) go(first, true)
  }, [sidebar, activeId, first])
  if (isDemo()) return <NoteScreen />
  if (sidebar) {
    return (
      <div className="shell" data-testid="shell" data-sidebar={hidden ? 'hidden' : 'shown'}>
        {!hidden && <Sidebar />}
        {activeId ? (
          <NoteScreen key={activeId} showSidebar={hidden} />
        ) : (
          <div className="app shell-empty">
            {hidden && <ShowSidebarButton />}
            <EmptyNotes text={first ? "Nothing open." : "No notes yet."} />
          </div>
        )}
        <DeleteDialog />
        <SettingsSheet />
      </div>
    )
  }
  return (
    <>
      {activeId ? <NoteScreen key={activeId} back /> : <Home />}
      <DeleteDialog />
      <SettingsSheet />
    </>
  )
}
