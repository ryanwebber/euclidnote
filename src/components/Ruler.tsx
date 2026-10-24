import type { PointerEvent } from 'react'
import { columnWeight } from '../model/ops'
import { MAX_FIT } from '../model/types'
import { PlusIcon } from './icons'

interface Props {
  columns: string[]
  sizes: number[]
  gap: number
  down: boolean
  onTab: (i: number, el: HTMLElement) => void
  onAdd: () => void
  onSeparatorDown: (i: number, e: PointerEvent<HTMLElement>) => void
}

const label = (t: string) => (t === 'auto' ? 'auto' : `${Math.round(columnWeight(t) * 100) / 100}x`)

// The column ruler, shown while editing: a tab for each column (tap for its menu), a handle
// between columns (drag to resize, a step at a time), and a button to add a column.
export function Ruler({ columns, sizes, gap, down, onTab, onAdd, onSeparatorDown }: Props) {
  const starts = sizes.map((_, i) => sizes.slice(0, i).reduce((s, v) => s + v, 0) + i * gap)
  const n = columns.length
  const canAdd = !down || n < MAX_FIT
  // In a down note the columns fill the width, so the add button borrows room from the last tab.
  const BTN = 30
  const lastShrink = down && canAdd ? BTN + 8 : 0
  const end = starts[n - 1] + sizes[n - 1]
  // Tabs stay clear of the grabbers between them.
  const inset = (i: number) => Math.max(0, Math.min(10, (sizes[i] - 30) / 2))
  const tabBox = (i: number) => {
    const left = i > 0 ? inset(i) : 0
    const right = down && i === n - 1 ? 0 : inset(i)
    return { left: starts[i] + left, width: Math.max(30, sizes[i] - left - right - (i === n - 1 ? lastShrink : 0)) }
  }
  return (
    <div className="ruler" data-testid="ruler">
      {columns.map((t, i) => (
        <button
          key={`tab-${i}`}
          className="col-tab"
          data-testid={`col-tab-${i}`}
          aria-label={`Column ${i + 1} options`}
          style={tabBox(i)}
          onClick={(e) => onTab(i, e.currentTarget)}
        >
          {label(t)}
        </button>
      ))}
      {columns.map((_, i) =>
        down && i === n - 1 ? null : (
          <div
            key={`sep-${i}`}
            className="sep"
            data-testid={`sep-${i}`}
            role="separator"
            aria-label="Resize column"
            style={{ left: starts[i] + sizes[i] + gap / 2 }}
            onPointerDown={(e) => onSeparatorDown(i, e)}
          />
        ),
      )}
      {canAdd && sizes.length >= n && (
        <button
          className="col-add"
          data-testid="col-add"
          aria-label="Add a column"
          style={{ left: down ? end - BTN : end + gap + 4 }}
          onClick={onAdd}
        >
          <PlusIcon size={18} />
        </button>
      )}
    </div>
  )
}
