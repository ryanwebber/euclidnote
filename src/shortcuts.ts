import { useEffect } from 'react'
import { deleteGroup, deleteLooseCell, getCell, moveRowInGroup, neighbor, nextInOrder } from './model/ops'
import { useStore } from './store'

// Desktop keyboard: undo/redo anywhere; arrows, Enter, Tab, Delete, Esc while a
// selection exists and no text is being typed.
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState()
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        return e.shiftKey ? s.redo() : s.undo()
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        return s.redo()
      }
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select') || s.mode !== 'edit') return
      const sel = s.selected
      if (!sel) return
      if (e.key === 'Escape') return s.select(null)
      if (sel.kind === 'group') {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault()
          s.edit((n) => deleteGroup(n, sel.g))
        }
        return
      }
      // Alt + up/down carries a group cell's row with it.
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && sel.ref.in === 'group') {
        const { g, r, c } = sel.ref
        const to = r + (e.key === 'ArrowUp' ? -1 : 1)
        const next = moveRowInGroup(s.note, g, r, to)
        if (next !== s.note) {
          e.preventDefault()
          s.edit(() => next)
          s.select({ kind: 'cell', ref: { in: 'group', g, r: to, c } })
        }
        return
      }
      const go = (ref: ReturnType<typeof neighbor>) => {
        if (!ref) return
        e.preventDefault()
        s.select({ kind: 'cell', ref })
      }
      if (e.key === 'ArrowUp') go(neighbor(s.note, sel.ref, 'up'))
      else if (e.key === 'ArrowDown') go(neighbor(s.note, sel.ref, 'down'))
      else if (e.key === 'ArrowLeft') go(neighbor(s.note, sel.ref, 'left'))
      else if (e.key === 'ArrowRight') go(neighbor(s.note, sel.ref, 'right'))
      else if (e.key === 'Tab') go(nextInOrder(s.note, sel.ref, e.shiftKey))
      else if (e.key === 'Enter' && getCell(s.note, sel.ref)?.type === 'text') {
        e.preventDefault()
        s.startEditing(sel.ref)
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && sel.ref.in === 'loose') {
        e.preventDefault()
        const { i } = sel.ref
        s.edit((n) => deleteLooseCell(n, i))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
