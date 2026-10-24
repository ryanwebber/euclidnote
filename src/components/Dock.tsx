import type { ReactNode } from 'react'
import { getCell } from '../model/ops'
import { type PopId, useStore } from '../store'
import { selectionActions } from './actions'
import {
  FillIcon,
  LayoutIcon,
  LookIcon,
  PlusIcon,
  RedoIcon,
  TextIcon,
  UndoIcon,
  WidgetIcon,
} from './icons'

// The bottom dock (phones), shown only while editing: undo/redo, and tools that follow the
// selection. Everything that is a gesture (move, resize, duplicate by dragging) is not
// here; these are the things with no natural gesture. Large screens use the inspector instead.
export function Dock() {
  const selected = useStore((s) => s.selected)
  const popover = useStore((s) => s.popover)
  const cell = useStore((s) => (s.selected?.kind === 'cell' ? getCell(s.note, s.selected.ref) : undefined))
  const canUndo = useStore((s) => s.history.past.length > 0)
  const canRedo = useStore((s) => s.history.future.length > 0)
  const { undo, redo, openPopover, closePopover } = useStore.getState()

  const toggle = (id: PopId) => (e: React.MouseEvent<HTMLElement>) => {
    if (useStore.getState().popover?.id === id) return closePopover()
    const r = e.currentTarget.getBoundingClientRect()
    openPopover({ id, x: r.left + r.width / 2, y: r.top, placement: 'above' })
  }
  const tool = (id: PopId, label: string, icon: ReactNode) => (
    <button key={id} className="tool" data-testid={`tool-${id}`} aria-label={label} aria-expanded={popover?.id === id} onClick={toggle(id)}>
      {icon}
      <span>{label}</span>
    </button>
  )
  const actions = selectionActions(selected).map((a) => (
    <button key={a.id} className="tool" data-testid={`tool-${a.id}`} aria-label={a.label} data-danger={a.danger} onClick={a.run}>
      {a.icon}
      <span>{a.short ?? a.label}</span>
    </button>
  ))

  return (
    <nav className="dock" data-testid="dock" aria-label="Tools">
      <div className="dock-group" data-side="left">
        <button className="icon-btn" data-testid="undo" aria-label="Undo" disabled={!canUndo} onClick={undo}><UndoIcon /></button>
        <button className="icon-btn" data-testid="redo" aria-label="Redo" disabled={!canRedo} onClick={redo}><RedoIcon /></button>
      </div>
      <div className="dock-group" data-side="tools">
        {!selected && (
          <>
            {tool('add', 'Add', <PlusIcon />)}
            {tool('layout', 'Layout', <LayoutIcon />)}
          </>
        )}
        {selected?.kind === 'cell' && cell && (
          <>
            {tool('format', 'Style', <TextIcon />)}
            {tool('fill', 'Fill', <FillIcon />)}
            {tool('widget', 'Widget', <WidgetIcon />)}
            {actions}
          </>
        )}
        {selected?.kind === 'group' && (
          <>
            {tool('look', 'Look', <LookIcon />)}
            {actions}
          </>
        )}
      </div>
    </nav>
  )
}
