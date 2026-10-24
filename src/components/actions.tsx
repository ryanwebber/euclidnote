import type { ReactNode } from 'react'
import {
  deleteColumnInGroup,
  deleteGroup,
  deleteLooseCell,
  deleteRowInGroup,
  duplicateGroupSmart,
  duplicateLoose,
  insertRowAfterInGroup,
  ungroup,
} from '../model/ops'
import type { Note, Selection } from '../model/types'
import { getCell } from '../model/ops'
import { useStore } from '../store'
import { DuplicateIcon, RowAddIcon, TrashIcon, UngroupIcon } from './icons'

export interface Action {
  id: string
  label: string
  // A shorter name for the cramped phone dock.
  short?: string
  icon: ReactNode
  danger?: boolean
  run: () => void
}

// Apply an op that adds something, then select what it added.
function addThen(fn: (n: Note) => Note, pick: (n: Note) => Selection | null) {
  const { note, edit, select } = useStore.getState()
  const next = fn(note)
  if (next === note) return
  edit(() => next)
  select(pick(next))
}

// What you can do to the current selection that is not a gesture. The phone dock and the
// large-screen inspector both list these, so they offer the same things.
export function selectionActions(sel: Selection | null): Action[] {
  const { edit } = useStore.getState()
  if (!sel) return []
  if (sel.kind === 'group') {
    const g = sel.g
    return [
      { id: 'duplicate', label: 'Duplicate', icon: <DuplicateIcon />, run: () => addThen((n) => duplicateGroupSmart(n, g), (n) => ({ kind: 'group', g: n.groups.length - 1 })) },
      { id: 'ungroup', label: 'Ungroup', icon: <UngroupIcon />, run: () => edit((n) => ungroup(n, g)) },
      { id: 'delete', label: 'Delete', icon: <TrashIcon />, danger: true, run: () => edit((n) => deleteGroup(n, g)) },
    ]
  }
  const ref = sel.ref
  if (ref.in === 'loose') {
    return [
      { id: 'duplicate', label: 'Duplicate', icon: <DuplicateIcon />, run: () => addThen((n) => duplicateLoose(n, ref.i), (n) => ({ kind: 'cell', ref: { in: 'loose', i: n.cells.length - 1 } })) },
      { id: 'delete', label: 'Delete', icon: <TrashIcon />, danger: true, run: () => edit((n) => deleteLooseCell(n, ref.i)) },
    ]
  }
  // After shrinking a group, keep a cell of it selected (the same place, or the nearest that is left).
  const stay = (n: Note): Selection | null => {
    const grp = n.groups[ref.g]
    if (!grp) return null
    const r = Math.min(ref.r, grp.rows.length - 1)
    const c = Math.min(ref.c, grp.rows[r].length - 1)
    return getCell(n, { in: 'group', g: ref.g, r, c }) ? { kind: 'cell', ref: { in: 'group', g: ref.g, r, c } } : null
  }
  const shrink = (fn: (n: Note) => Note) => () => {
    const { note, edit, select } = useStore.getState()
    const next = fn(note)
    if (next === note) return
    edit(() => next)
    select(stay(next))
  }
  return [
    {
      id: 'add-row',
      label: 'Add row',
      icon: <RowAddIcon />,
      run: () => addThen((n) => insertRowAfterInGroup(n, ref.g, ref.r), () => ({ kind: 'cell', ref: { in: 'group', g: ref.g, r: ref.r + 1, c: ref.c } })),
    },
    { id: 'delete-row', label: 'Delete row', short: 'Del row', icon: <TrashIcon />, danger: true, run: shrink((n) => deleteRowInGroup(n, ref.g, ref.r)) },
    { id: 'delete-column', label: 'Delete column', short: 'Del col', icon: <TrashIcon />, danger: true, run: shrink((n) => deleteColumnInGroup(n, ref.g, ref.r, ref.c)) },
  ]
}
