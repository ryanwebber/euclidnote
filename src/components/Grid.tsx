import { type CSSProperties, type PointerEvent, type RefObject, useLayoutEffect, useRef, useState } from 'react'
import {
  type Rect,
  type Side,
  cellWidth,
  duplicateTarget,
  extent,
  groupCells,
  groupRect,
  locate,
  resizeTarget,
} from '../model/geometry'
import {
  addCell,
  columnWeight,
  createGroupAt,
  duplicateGroup,
  fillCell,
  insertColumnAt,
  moveGroup,
  moveLoose,
  moveRowInGroup,
  resizeGroup,
  setColumnWeight,
  setSpan,
  shiftSeparator,
} from '../model/ops'
import { type Cell, type CellRef, DEFAULT_FIT, type Fill, type Note, type Variant } from '../model/types'
import { haptic } from '../hooks'
import { useStore } from '../store'
import { isTall } from '../model/geometry'
import { CellView } from './CellView'
import { GripIcon } from './icons'
import { type Planner, useDrag } from './drag'
import { Ruler } from './Ruler'
import { area, surfaces } from './Surfaces'

const sizes = (v: string) => v.split(' ').map(Number.parseFloat).filter(Number.isFinite)
// Counters and timers are full-size cells; everything else sits in a compact row.
const rowIsTall = (row: Cell[]) => row.some(isTall)

interface Item {
  ref: CellRef
  x: number
  y: number
  w: number
  cell: Cell
  variant: Variant
  groupFill?: Fill
  lastRow?: boolean
  lastCol?: boolean
  firstCol?: boolean
  firstRow?: boolean
}

// The whole note: one grid. In a `down` note columns share the width; in a `right`
// note a column is as wide as a row is tall (--u) times its weight.
export function Grid({ scrollRef }: { scrollRef: RefObject<HTMLElement | null> }) {
  const note = useStore((s) => s.note)
  const editMode = useStore((s) => s.mode === 'edit')
  const selected = useStore((s) => s.selected)
  const select = useStore((s) => s.select)
  const edit = useStore((s) => s.edit)
  const startEditing = useStore((s) => s.startEditing)
  const openPopover = useStore((s) => s.openPopover)
  const gridRef = useRef<HTMLDivElement>(null)
  const { plan, begin } = useDrag(gridRef, scrollRef, (p) => {
    edit(() => p.next, p.key)
    if (p.select) select(p.select)
    if (p.then === 'look') {
      const box = scrollRef.current?.getBoundingClientRect()
      openPopover({ id: 'look', x: (box?.left ?? 0) + (box?.width ?? 0) / 2, y: 0, placement: 'above' })
    }
  })

  // ---- long-press to pick up the selected cell ----
  // Holding the selected cell still for a moment lifts it: a loose cell moves, a cell in a group takes its row for a ride.
  // Moving before then is a scroll, and releasing is a tap.
  const holding = useRef<{ stop: () => void } | null>(null)
  const lift = useRef<(cell: HTMLElement, pointerId: number, at: { x: number; y: number }) => void>(() => undefined)

  // While a live drag (column widths) is in flight the grid draws the plan itself.
  const view = plan?.live ? plan.next : note
  const down = view.flow === 'down'
  const used = extent(view)
  // The number of cells that share the axis that fits the screen; sizes derive from it.
  const n = Math.max(DEFAULT_FIT, down ? view.columns.length : used.rows)
  const template = view.columns
    .map((t) => (t === 'auto' ? 'auto' : down ? `minmax(0, ${t})` : `calc(var(--u) * ${Number.parseFloat(t)})`))
    .join(' ')

  // Measured column sizes, for the ruler.
  const [cols, setCols] = useState<{ sizes: number[]; gap: number }>({ sizes: [], gap: 0 })
  const colKey = `${view.flow}|${view.columns.join(',')}`
  useLayoutEffect(() => {
    const el = gridRef.current
    if (!el) return
    const measure = () => {
      const cs = getComputedStyle(el)
      const next = { sizes: sizes(cs.gridTemplateColumns), gap: Number.parseFloat(cs.columnGap) || 0 }
      setCols((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [colKey])

  // One square (a 1x column) and the dot matrix step, which is half of it plus half a gap.
  const weights = view.columns.map((t) => (t === 'auto' ? 0 : columnWeight(t)))
  const wsum = weights.reduce((a, b) => a + b, 0)
  const measured = cols.sizes.length >= view.columns.length && wsum > 0
  const square = measured ? weights.reduce((a, w, i) => a + (w > 0 ? cols.sizes[i] : 0), 0) / wsum : 0
  const pitch = measured ? `${(square + cols.gap) / 2}px` : undefined

  const items: Item[] = [
    ...view.cells.map((p, i): Item => ({ ref: { in: 'loose', i }, x: p.x, y: p.y, w: cellWidth(p.cell), cell: p.cell, variant: 'plain' })),
    ...view.groups.flatMap((g, gi) => {
      const r = groupRect(g)
      return groupCells(g).map(
        (pc): Item => ({
          ref: { in: 'group', g: gi, r: pc.r, c: pc.c },
          x: pc.x,
          y: pc.y,
          w: pc.w,
          cell: pc.cell,
          variant: g.variant,
          groupFill: g.fill,
          lastRow: pc.r === g.rows.length - 1,
          lastCol: pc.x + pc.w >= r.x + r.w,
          firstCol: pc.x === r.x,
          firstRow: pc.r === 0,
        }),
      )
    }),
  ]

  // Down notes: a row of only text is a compact list row; a row with a counter or timer is a full cell.
  // While dragging, the rows the ghost will occupy count too, so it is as tall as the real result.
  const ghostActive = plan && !plan.live && plan.rect
  const tallRows = new Set([...items.filter((it) => isTall(it.cell)).map((it) => it.y), ...(ghostActive ? (plan.tall ?? []) : [])])
  const rowCount = Math.max(used.rows, ghostActive ? plan.rect!.y + plan.rect!.h : 0)
  const rowTemplate = down
    ? Array.from({ length: rowCount }, (_, y) => (tallRows.has(y) ? 'minmax(var(--u), auto)' : 'var(--row-text)')).join(' ')
    : undefined

  // Empty slots you can tap to add a cell, or drag across to make a group (edit mode): the
  // used area plus one more row (down) or column (right) to grow into.
  const taken = new Set(items.flatMap((it) => Array.from({ length: it.w }, (_, k) => `${it.x + k},${it.y}`)))
  const slots: { x: number; y: number }[] = []
  if (editMode) {
    const xMax = down ? view.columns.length : used.cols + 1
    const yMax = Math.max(down ? used.rows + 1 : n, 2)
    for (let y = 0; y < yMax; y++) for (let x = 0; x < xMax; x++) if (!taken.has(`${x},${y}`)) slots.push({ x, y })
  }

  // ---- what each handle does when dragged ----
  const verdict = (next: Note) => next !== note
  const shapeOf = (g: number) => ({ variant: note.groups[g].variant, fill: note.groups[g].fill })
  // The rows of group g that hold big widgets, if it were placed with its top at y.
  const tallAt = (g: number, y: number) => note.groups[g].rows.flatMap((row, r) => (rowIsTall(row) ? [y + r] : []))

  // Moving puts the item's top-left corner under your finger.
  const planMoveGroup = (g: number): Planner => (_at, pt, _origin, ctx) => {
    const r = groupRect(note.groups[g])
    const { col: x, row: y } = ctx.topLeft(pt)
    if (x === r.x && y === r.y) return null
    const next = moveGroup(note, g, x, y)
    return { next, valid: verdict(next), rect: { x, y, w: r.w, h: r.h }, select: { kind: 'group', g }, shape: shapeOf(g), tall: tallAt(g, y) }
  }
  const planMoveLoose = (i: number): Planner => (_at, pt, _origin, ctx) => {
    const p = note.cells[i]
    const { col: x, row: y } = ctx.topLeft(pt)
    if (x === p.x && y === p.y) return null
    const next = moveLoose(note, i, x, y)
    return { next, valid: verdict(next), rect: { x, y, w: cellWidth(p.cell), h: 1 }, select: { kind: 'cell', ref: { in: 'loose', i } }, shape: { variant: 'cell' }, tall: isTall(p.cell) ? [y] : [] }
  }
  // A row of a group moves up or down among its group's rows; the group itself stays put.
  const planMoveRow = (g: number, r: number, c: number): Planner => (at) => {
    const grp = note.groups[g]
    const to = Math.max(0, Math.min(grp.rows.length - 1, at.row - grp.y))
    if (to === r) return null
    const next = moveRowInGroup(note, g, r, to)
    return {
      next,
      valid: verdict(next),
      rect: { x: grp.x, y: grp.y + to, w: groupRect(grp).w, h: 1 },
      select: { kind: 'cell', ref: { in: 'group', g, r: to, c } },
      shape: { variant: 'cell' },
      tall: rowIsTall(grp.rows[r]) ? [grp.y + to] : [],
    }
  }
  const planDuplicate = (g: number, side: Side): Planner => (at) => {
    const r = groupRect(note.groups[g])
    const { x, y } = duplicateTarget(side, r, at)
    const next = duplicateGroup(note, g, x, y)
    return { next, valid: verdict(next), rect: { x, y, w: r.w, h: r.h }, select: { kind: 'group', g: next.groups.length - 1 }, shape: shapeOf(g), tall: tallAt(g, y) }
  }
  const planResize = (g: number): Planner => (at) => {
    const r = groupRect(note.groups[g])
    const { w, h } = resizeTarget(r, at)
    if (w === r.w && h === r.h) return null
    const next = resizeGroup(note, g, w, h)
    const rows = note.groups[g].rows
    const tall = Array.from({ length: h }, (_, k) => (rowIsTall(rows[Math.min(k, rows.length - 1)]) ? r.y + k : -1)).filter((y) => y >= 0)
    return { next, valid: verdict(next), rect: { x: r.x, y: r.y, w, h }, shape: shapeOf(g), tall }
  }
  lift.current = (cellEl, pointerId, at) => {
    if (selected?.kind !== 'cell') return
    const ref = selected.ref
    const planner = ref.in === 'loose' ? planMoveLoose(ref.i) : planMoveRow(ref.g, ref.r, ref.c)
    cellEl.setAttribute('data-lifted', 'true')
    haptic(14)
    // A finger that has not moved can still be stopped from scrolling the page.
    const noScroll = (ev: TouchEvent) => ev.cancelable && ev.preventDefault()
    document.addEventListener('touchmove', noScroll, { passive: false })
    // Letting go ends with a click on the cell; it should not start editing its text.
    const swallow = (ev: MouseEvent) => (ev.stopPropagation(), ev.preventDefault())
    window.addEventListener('click', swallow, { capture: true, once: true })
    begin({ currentTarget: cellEl, pointerId, clientX: at.x, clientY: at.y, stopPropagation: () => undefined }, planner, undefined, {
      frame: cellEl,
      onEnd: () => {
        cellEl.removeAttribute('data-lifted')
        document.removeEventListener('touchmove', noScroll)
        setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 80)
      },
    })
  }
  const holdStart = (e: PointerEvent<HTMLElement>) => {
    if (!editMode || selected?.kind !== 'cell' || e.button > 0) return
    const target = e.target as HTMLElement
    const cellEl = target.closest<HTMLElement>('.cell')
    if (!cellEl || cellEl.dataset.selected !== 'true' || cellEl.dataset.editing === 'true') return
    if (target.closest('.handle, input, textarea, [contenteditable="true"]')) return
    holding.current?.stop()
    const start = { x: e.clientX, y: e.clientY }
    let at = start
    const pointerId = e.pointerId
    const stop = () => {
      clearTimeout(timer)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      holding.current = null
    }
    const move = (ev: globalThis.PointerEvent) => {
      at = { x: ev.clientX, y: ev.clientY }
      if (Math.hypot(at.x - start.x, at.y - start.y) > 8) stop() // that is a scroll
    }
    const timer = setTimeout(() => {
      stop()
      lift.current(cellEl, pointerId, at)
    }, 420)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    holding.current = { stop }
  }

  const planFill = (i: number): Planner => (at) => {
    const p = note.cells[i]
    const unit = cellWidth(p.cell)
    const { w, h } = resizeTarget({ x: p.x, y: p.y, w: unit, h: 1 }, at)
    if (w < unit * 2 && h < 2) return null
    const next = fillCell(note, i, w, h)
    return {
      next,
      valid: verdict(next),
      rect: { x: p.x, y: p.y, w: Math.floor(w / unit) * unit, h },
      select: { kind: 'group', g: next.groups.length - 1 },
      shape: { variant: 'plain' },
      tall: isTall(p.cell) ? Array.from({ length: h }, (_, k) => p.y + k) : [],
    }
  }
  const planSpan = (ref: CellRef): Planner => (at) => {
    const loc = locate(note, ref)
    if (!loc) return null
    const w = Math.max(1, at.col - loc.x + 1)
    if (w === loc.w) return null
    const next = setSpan(note, ref, w)
    return { next, valid: verdict(next), rect: { x: loc.x, y: loc.y, w, h: 1 }, shape: { variant: 'cell' } }
  }
  // Pressing an empty slot and dragging sweeps out a new group over the cells you cover.
  const planSlot = (sx: number, sy: number): Planner => (at) => {
    const x = Math.min(sx, at.col)
    const y = Math.min(sy, at.row)
    const w = Math.abs(at.col - sx) + 1
    const h = Math.abs(at.row - sy) + 1
    if (w === 1 && h === 1) return null
    const next = createGroupAt(note, x, y, w, h, 'card')
    return { next, valid: verdict(next), rect: { x, y, w, h }, select: { kind: 'group', g: next.groups.length - 1 }, then: 'look', shape: { variant: 'card' } }
  }
  const planSeparator = (i: number, startX: number): Planner => (_at, pt) => {
    const dx = pt.x - startX
    const a = columnWeight(note.columns[i])
    const next = down
      ? shiftSeparator(note, i, dx / ((cols.sizes[i] + cols.sizes[i + 1]) / (a + columnWeight(note.columns[i + 1]))))
      : setColumnWeight(note, i, a + dx / (cols.sizes[i] / a))
    return { next, valid: verdict(next), live: true, key: 'columns', tick: next.columns.join(',') }
  }

  // ---- selection geometry ----
  let selRect: Rect | null = null
  if (editMode && selected?.kind === 'group' && view.groups[selected.g]) selRect = groupRect(view.groups[selected.g])
  else if (editMode && selected?.kind === 'cell') {
    const loc = locate(view, selected.ref)
    if (loc) selRect = { x: loc.x, y: loc.y, w: loc.w, h: 1 }
  }

  const dot = (kind: string, label: string, planner: Planner, extra?: { onTap?: () => void }) => (
    <div
      key={kind}
      className="handle"
      data-kind={kind}
      data-testid={`handle-${kind}`}
      role="button"
      aria-label={label}
      onPointerDown={(e: PointerEvent<HTMLElement>) => begin(e, planner, extra?.onTap)}
    >
      {kind === 'grip' && <span className="pill"><GripIcon size={16} /></span>}
    </div>
  )

  const selectedRef = selected?.kind === 'cell' ? selected.ref : null
  const groupOfCell = selectedRef?.in === 'group' ? selectedRef.g : null
  const empty = view.cells.length === 0 && view.groups.length === 0
  // A row where any widget has a caption keeps a caption line on every widget, so same-sized widgets line up.
  const labelRows = new Set(items.filter((it) => (it.cell as { label?: string }).label).map((it) => it.y))

  return (
    <div
      ref={gridRef}
      className="grid"
      data-testid="grid"
      data-empty={empty}
      onPointerDown={holdStart}
      onContextMenu={(e) => holding.current && e.preventDefault()}
      style={{ gridTemplateColumns: template, gridTemplateRows: rowTemplate || undefined, '--n': n, '--pitch': pitch } as CSSProperties}
    >
      {/* Surfaces behind the cells, one look per group. */}
      {view.groups.flatMap((g, gi) => surfaces({ ...groupRect(g), variant: g.variant, fill: g.fill }, `bg-${gi}`))}
      {items.map((it) => (
        <CellView
          key={it.ref.in === 'loose' ? `l${it.ref.i}` : `g${it.ref.g}-${it.ref.r}-${it.ref.c}`}
          cell={it.cell}
          cellRef={it.ref}
          x={it.x}
          y={it.y}
          w={it.w}
          variant={it.variant}
          lastRow={it.lastRow}
          lastCol={it.lastCol}
          firstCol={it.firstCol}
          firstRow={it.firstRow}
          groupFill={it.groupFill}
          reserve={labelRows.has(it.y)}
        />
      ))}
      {slots.map(({ x, y }) => (
        <div
          key={`slot-${x}-${y}`}
          className="slot"
          data-testid={`slot-${x}-${y}`}
          role="button"
          aria-label="Add a cell. Drag to make a group."
          style={{ gridArea: area({ x, y, w: 1, h: 1 }) }}
          onPointerDown={(e) =>
            begin(e, planSlot(x, y), () => {
              const next = addCell(note, x, y)
              if (next === note) return
              edit(() => next)
              startEditing({ in: 'loose', i: next.cells.length - 1 })
            })
          }
        />
      ))}
      {editMode &&
        view.groups.map((g, gi) => {
          if (selected?.kind === 'group' && selected.g === gi) return null
          return (
            <div key={`frame-${gi}`} className="gframe" data-look={g.variant} data-top={groupRect(g).y === 0} style={{ gridArea: area(groupRect(g)) }}>
              {groupOfCell !== gi && (
                <div
                  className="handle"
                  data-kind="grip"
                  data-testid={`group-grip-${gi}`}
                  role="button"
                  aria-label="Select or move group"
                  onPointerDown={(e) => begin(e, planMoveGroup(gi), () => select({ kind: 'group', g: gi }))}
                >
                  <span className="pill"><GripIcon size={16} /></span>
                </div>
              )}
            </div>
          )
        })}
      {selRect && selected && (
        <div className="sel" data-kind={selected.kind} data-top={selRect.y === 0} data-testid="selection" style={{ gridArea: area(selRect) }}>
          {selected.kind === 'group' && (
            <>
              {dot('grip', 'Move group', planMoveGroup(selected.g))}
              {(['top', 'bottom', 'left', 'right'] as const).map((side) => dot(side, `Duplicate ${side}`, planDuplicate(selected.g, side)))}
              {dot('corner', 'Resize group', planResize(selected.g))}
            </>
          )}
          {selected.kind === 'cell' && (
            <>
              {selected.ref.in === 'loose'
                ? dot('grip', 'Move cell', planMoveLoose(selected.ref.i))
                : dot('grip', 'Select group, or drag to move this row', planMoveRow(selected.ref.g, selected.ref.r, selected.ref.c), {
                    onTap: () => select({ kind: 'group', g: (selected.ref as { g: number }).g }),
                  })}
              {dot('span', 'Span columns', planSpan(selected.ref))}
              {selected.ref.in === 'loose' && dot('fill', 'Fill to make a group', planFill(selected.ref.i))}
            </>
          )}
        </div>
      )}
      {editMode && cols.sizes.length >= view.columns.length && (
        <Ruler
          columns={view.columns}
          sizes={cols.sizes.slice(0, view.columns.length)}
          gap={cols.gap}
          down={down}
          onTab={(i, el) => {
            const r = el.getBoundingClientRect()
            openPopover({ id: 'column', index: i, x: r.left + r.width / 2, y: r.bottom + 8, placement: 'below' })
          }}
          onAdd={() => edit((nn) => insertColumnAt(nn, nn.columns.length))}
          onSeparatorDown={(i, e) => begin(e, planSeparator(i, e.clientX))}
        />
      )}
      {plan && !plan.live && plan.rect && (
        // The ghost is the real thing, drawn faintly where it would land.
        <div className="ghost-layer" data-valid={plan.valid} data-testid="ghost">
          {surfaces({ ...plan.rect, variant: plan.shape?.variant ?? 'plain', fill: plan.shape?.fill }, 'ghost', true)}
        </div>
      )}
    </div>
  )
}
