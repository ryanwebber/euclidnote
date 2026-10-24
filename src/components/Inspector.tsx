import { getCell } from '../model/ops'
import { useStore } from '../store'
import { selectionActions } from './actions'
import { AddSheet, FillSheet, FormatSheet, LayoutSheet, LookSheet, TYPE_NAMES, WidgetSheet } from './Popovers'

// The large-screen editing panel: everything the dock's sheets offer, always open beside the
// note and following the selection, instead of popping up.
export function Inspector() {
  const selected = useStore((s) => s.selected)
  const cell = useStore((s) => (s.selected?.kind === 'cell' ? getCell(s.note, s.selected.ref) : undefined))
  const group = useStore((s) => (s.selected?.kind === 'group' ? s.note.groups[s.selected.g] : undefined))
  const actions = selectionActions(selected)

  let what = 'Note'
  if (cell) what = `Cell · ${TYPE_NAMES[cell.type]}`
  if (group) what = `Group · ${group.variant}`

  return (
    <aside className="inspector" data-testid="inspector" aria-label="Inspector">
      <header className="insp-head">
        <h2 data-testid="insp-what">{what}</h2>
        {actions.length > 0 && (
          <div className="insp-actions">
            {actions.map((a) => (
              <button key={a.id} className="insp-action" data-testid={`tool-${a.id}`} data-danger={a.danger} onClick={a.run}>
                {a.icon}
                <span>{a.label}</span>
              </button>
            ))}
          </div>
        )}
      </header>
      <div className="insp-body">
        {!selected && (
          <>
            <h3 className="insp-h">Add</h3>
            <AddSheet close={() => undefined} />
            <h3 className="insp-h">Layout</h3>
            <LayoutSheet />
          </>
        )}
        {selected?.kind === 'cell' && cell && (
          <>
            <h3 className="insp-h">Fill</h3>
            <FillSheet sel={selected} />
            <h3 className="insp-h">Style</h3>
            <FormatSheet sel={selected} />
            <h3 className="insp-h">Widget</h3>
            <WidgetSheet sel={selected} />
          </>
        )}
        {selected?.kind === 'group' && group && <LookSheet g={selected.g} />}
      </div>
    </aside>
  )
}
