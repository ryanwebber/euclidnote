import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { appendRowBelow, neighbor, nextInOrder, patchCell, setCellText, updateCell } from '../model/ops'
import type {
  BadgeCell, BarsCell, Cell, CellRef, CheckCell, CountdownCell, CounterCell, DateCell, HabitCell, LinkCell, MoodCell,
  NumberCell, PipsCell, ProgressCell, RatingCell, TagCell, TimeCell, TimerCell, ToggleCell, Variant,
} from '../model/types'
import {
  HABIT_DAYS, MOODS, barHeight, clampProgress, describeCountdown, describeDate, formatClock, formatDuration, habitCount,
  linkLabel, nextTag, normalizeUrl, resetTimer, ringValue, setBar, setPips, tagTone, timerFinished,
  timerShown, toggleDay, toggleMood, toggleRating, toggleTimer,
} from '../model/widgets'
import { haptic, useNow } from '../hooks'
import { sameRef, useStore } from '../store'
import { CheckIcon, LinkIcon, MinusIcon, MoodFace, NamedIcon, PauseIcon, PlayIcon, PlusBoldIcon, ResetIcon } from './icons'

interface Props {
  cell: Cell
  cellRef: CellRef
  // Grid position and width in columns (cells are always one row tall).
  x: number
  y: number
  w: number
  variant: Variant
  lastRow?: boolean
  lastCol?: boolean
  firstCol?: boolean
  firstRow?: boolean
  // The tint of the group this cell belongs to, if any.
  groupFill?: string
  // Keep a caption line even when this widget has none (a neighbour in its row does).
  reserve?: boolean
}

type Captioned = CounterCell | TimerCell | RatingCell | ProgressCell | DateCell | NumberCell | MoodCell | HabitCell | CountdownCell | PipsCell | TimeCell | BadgeCell | BarsCell
const CAPTIONED = ['counter', 'timer', 'rating', 'progress', 'date', 'number', 'mood', 'habit', 'countdown', 'pips', 'time', 'badge', 'bars']
// Widgets with a small caption that can be edited in place.
const hasLabel = (c: Cell): c is Captioned => CAPTIONED.includes(c.type)
const hasText = (c: Cell): c is TextLike => c.type === 'text' || c.type === 'check' || c.type === 'toggle' || c.type === 'link'
type TextLike = Cell & { text: string }

export function CellView({ cell, cellRef, x, y, w, variant, lastRow, lastCol, firstCol, firstRow, groupFill, reserve }: Props) {
  const editMode = useStore((s) => s.mode === 'edit')
  const selected = useStore((s) => s.selected)
  const editing = useStore((s) => s.editing)
  const select = useStore((s) => s.select)
  const startEditing = useStore((s) => s.startEditing)
  const isSelected = selected?.kind === 'cell' && sameRef(selected.ref, cellRef)
  const isEditing = !!editing && sameRef(editing, cellRef)
  const st = cell.style

  // Tap once to select, again to edit the text (or the caption of a widget).
  const onClick = () => {
    if (!editMode) return
    if (isSelected && (hasText(cell) || hasLabel(cell))) startEditing(cellRef)
    else select({ kind: 'cell', ref: cellRef })
  }

  return (
    <div
      className="cell"
      data-testid={`cell-${x}-${y}`}
      data-variant={variant}
      data-loose={cellRef.in === 'loose'}
      data-align={st?.align}
      data-arrange={st?.layout ?? (variant === 'tiles' || cellRef.in === 'loose' ? 'center' : 'auto')}
      data-gfill={groupFill}
      data-last-row={lastRow}
      data-last-col={lastCol}
      data-first-col={firstCol}
      data-first-row={firstRow}
      data-selected={isSelected}
      data-editing={isEditing}
      data-size={st?.size}
      data-fill={st?.fill}
      data-font={st?.font}
      data-border={st?.border}
      data-color={st?.color}
      data-underline={st?.underline}
      data-strike={st?.strike}
      data-empty={hasText(cell) && cell.text === ''}
      data-type={cell.type}
      data-reserve={reserve}
      onClick={onClick}
      style={
        {
          gridArea: `${y + 1} / ${x + 1} / span 1 / span ${w}`,
          textAlign: st?.align,
          fontWeight: st?.bold ? 700 : undefined,
          fontStyle: st?.italic ? 'italic' : undefined,
        } as CSSProperties
      }
    >
      {cell.type === 'text' && <TextBody cell={cell} cellRef={cellRef} editing={isEditing} />}
      {cell.type === 'check' && <CheckBody cell={cell} cellRef={cellRef} editing={isEditing} />}
      {cell.type === 'toggle' && <ToggleBody cell={cell} cellRef={cellRef} editing={isEditing} />}
      {cell.type === 'link' && <LinkBody cell={cell} cellRef={cellRef} editing={isEditing} />}
      {cell.type === 'badge' && <BadgeBody cell={cell} cellRef={cellRef} editing={isEditing} selected={isSelected} />}
      {cell.type === 'pips' && <PipsBody cell={cell} cellRef={cellRef} editing={isEditing} selected={isSelected} />}
      {cell.type === 'bars' && <BarsBody cell={cell} cellRef={cellRef} editing={isEditing} selected={isSelected} />}
      {cell.type === 'time' && <TimeBody cell={cell} cellRef={cellRef} editing={isEditing} selected={isSelected} />}
      {cell.type === 'counter' && <CounterBody cell={cell} cellRef={cellRef} editing={isEditing} selected={isSelected} />}
      {cell.type === 'number' && <NumberBody cell={cell} cellRef={cellRef} editing={isEditing} selected={isSelected} />}
      {cell.type === 'timer' && <TimerBody cell={cell} cellRef={cellRef} editing={isEditing} selected={isSelected} />}
      {cell.type === 'rating' && <RatingBody cell={cell} cellRef={cellRef} editing={isEditing} selected={isSelected} />}
      {cell.type === 'mood' && <MoodBody cell={cell} cellRef={cellRef} editing={isEditing} selected={isSelected} />}
      {cell.type === 'progress' && <ProgressBody cell={cell} cellRef={cellRef} editing={isEditing} selected={isSelected} />}
      {cell.type === 'habit' && <HabitBody cell={cell} cellRef={cellRef} editing={isEditing} selected={isSelected} />}
      {cell.type === 'tag' && <TagBody cell={cell} cellRef={cellRef} />}
      {cell.type === 'date' && <DateBody cell={cell} cellRef={cellRef} editing={isEditing} selected={isSelected} />}
      {cell.type === 'countdown' && <CountdownBody cell={cell} cellRef={cellRef} editing={isEditing} selected={isSelected} />}
    </div>
  )
}

// ---------- text ----------

function Leading({ cell }: { cell: Cell }) {
  return cell.style?.icon ? (
    <span className="icon" aria-hidden="true">
      <NamedIcon name={cell.style.icon} size={18} />
    </span>
  ) : null
}

// Return and Tab move through the text cells; in the last row of a group, Return adds a row.
function useTextKeys(cellRef: CellRef) {
  const edit = useStore((s) => s.edit)
  const stopEditing = useStore((s) => s.stopEditing)
  const go = (to: CellRef | null) => {
    const { select, startEditing, note } = useStore.getState()
    if (!to) return stopEditing()
    const t = to.in === 'loose' ? note.cells[to.i]?.cell : note.groups[to.g]?.rows[to.r]?.[to.c]
    if (t && hasText(t)) startEditing(to)
    else {
      stopEditing()
      select({ kind: 'cell', ref: to })
    }
  }
  return (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const { note } = useStore.getState()
    if (e.key === 'Escape') {
      e.preventDefault()
      stopEditing()
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const below = neighbor(note, cellRef, 'down')
      if (below) return go(below)
      const grown = appendRowBelow(note, cellRef)
      if (grown !== note && cellRef.in === 'group') {
        edit(() => grown)
        return go({ ...cellRef, r: cellRef.r + 1 })
      }
      stopEditing()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      go(nextInOrder(note, cellRef, e.shiftKey))
    }
  }
}

function TextEditor({ text, cellRef, onChange }: { text: string; cellRef: CellRef; onChange: (t: string) => void }) {
  const ta = useRef<HTMLTextAreaElement>(null)
  const stopEditing = useStore((s) => s.stopEditing)
  const onKeyDown = useTextKeys(cellRef)
  useEffect(() => {
    const el = ta.current
    if (el) {
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    }
  }, [])
  return (
    <textarea
      ref={ta}
      className="text-input"
      data-testid="text-editor"
      rows={1}
      value={text}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => stopEditing()}
    />
  )
}

// Text is a plain element until you tap a selected cell; then it becomes an editor.
function TextBody({ cell, cellRef, editing }: { cell: Cell & { type: 'text' }; cellRef: CellRef; editing: boolean }) {
  const edit = useStore((s) => s.edit)
  return (
    <div className="textline">
      <Leading cell={cell} />
      {editing ? (
        <TextEditor text={cell.text} cellRef={cellRef} onChange={(t) => edit((n) => setCellText(n, cellRef, t), 'text')} />
      ) : (
        <span className="text">{cell.text}</span>
      )}
    </div>
  )
}

// ---------- captions ----------

// The small caption above a widget's value. Editable in place in edit mode.
function Caption({ cell, cellRef, editing, selected }: { cell: Captioned; cellRef: CellRef; editing: boolean; selected: boolean }) {
  const edit = useStore((s) => s.edit)
  const stopEditing = useStore((s) => s.stopEditing)
  const editMode = useStore((s) => s.mode === 'edit')
  const label = cell.label ?? ''
  if (editing) {
    return (
      <input
        className="label-input"
        data-testid="label-editor"
        autoFocus
        placeholder="Label"
        value={label}
        onChange={(e) => edit((n) => patchCell(n, cellRef, { label: e.target.value }), 'label')}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === 'Escape') && (e.preventDefault(), stopEditing())}
        onBlur={() => stopEditing()}
      />
    )
  }
  if (label) return <span className="label" data-testid="label">{label}</span>
  // A hint that a caption can be added, only while the cell is selected.
  if (editMode && selected) return <span className="label hint">Label</span>
  // Blank: takes no room unless a neighbour in the row has a caption (see data-reserve).
  return <span className="label" data-blank aria-hidden="true" />
}

interface W<T> { cell: T; cellRef: CellRef; editing: boolean; selected: boolean }

// ---------- widgets ----------

function CounterBody({ cell, cellRef, editing, selected }: W<CounterCell>) {
  const interact = useStore((s) => s.interact)
  const bump = (dir: 1 | -1) =>
    interact((n) => updateCell(n, cellRef, (c) => (c.type === 'counter' ? { ...c, value: c.value + dir * c.step } : c)))
  const reached = cell.goal !== undefined && cell.value >= cell.goal
  return (
    <div className="counter" data-reached={reached}>
      <Caption cell={cell} cellRef={cellRef} editing={editing} selected={selected} />
      <div className="value">
        <strong key={cell.value} data-testid="counter-value">{cell.value}</strong>
        {cell.goal !== undefined && <span className="of" data-testid="counter-goal">/ {cell.goal}</span>}
      </div>
      <div className="buttons">
        <button aria-label="Decrease" data-testid="counter-dec" onClick={() => bump(-1)}><MinusIcon size={16} /></button>
        <button aria-label="Increase" data-testid="counter-inc" onClick={() => bump(1)}><PlusBoldIcon size={16} /></button>
      </div>
    </div>
  )
}

// A number you type straight into, with an optional unit. Drafts live in the input; the note
// is updated when you finish, not on every keystroke.
function NumberBody({ cell, cellRef, editing, selected }: W<NumberCell>) {
  const interact = useStore((s) => s.interact)
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? (cell.value === null ? '' : String(cell.value))
  const commit = () => {
    if (draft === null) return
    const n = draft.trim() === '' ? null : Number(draft.replace(',', '.'))
    if (n === null || Number.isFinite(n)) interact((note) => patchCell(note, cellRef, { value: n }))
    setDraft(null)
  }
  return (
    <div className="number">
      <Caption cell={cell} cellRef={cellRef} editing={editing} selected={selected} />
      <div className="field-row">
        {cell.prefix && <span className="unit" data-testid="number-prefix">{cell.prefix}</span>}
        <input
          className="number-input"
          data-testid="number-input"
          inputMode="decimal"
          aria-label={cell.label ?? 'Number'}
          placeholder="0"
          value={shown}
          style={{ width: `${Math.max(1, shown.length) + 0.2}ch` }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        {cell.unit && <span className="unit" data-testid="number-unit">{cell.unit}</span>}
      </div>
    </div>
  )
}

function TimerBody({ cell, cellRef, editing, selected }: W<TimerCell>) {
  const interact = useStore((s) => s.interact)
  const running = cell.since !== null
  const now = useNow(running)
  const finished = timerFinished(cell, now)
  const apply = (fn: (t: TimerCell) => TimerCell) =>
    interact((n) => updateCell(n, cellRef, (c) => (c.type === 'timer' ? fn(c) : c)))
  // A countdown stops itself at zero.
  useEffect(() => {
    if (running && finished) {
      haptic(220)
      apply((t) => ({ ...t, ms: t.from ?? t.ms, since: null }))
    }
  }, [running, finished])
  const done = !running && cell.from !== undefined && cell.ms >= cell.from
  const press = () => apply((t) => (done ? { ...resetTimer(t), since: Date.now() } : toggleTimer(t, Date.now())))
  return (
    <div className="timer" data-running={running} data-done={done} data-countdown={cell.from !== undefined}>
      <Caption cell={cell} cellRef={cellRef} editing={editing} selected={selected} />
      <div className="value">
        {running && <i className="live" aria-hidden="true" />}
        <strong data-testid="timer-value">{done ? 'Done' : formatDuration(timerShown(cell, now))}</strong>
      </div>
      <div className="buttons">
        <button aria-label={running ? 'Pause' : 'Start'} data-testid="timer-toggle" data-primary onClick={press}>
          {running ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
        </button>
        <button aria-label="Reset" data-testid="timer-reset" onClick={() => apply(resetTimer)}><ResetIcon size={16} /></button>
      </div>
    </div>
  )
}

function CheckBody({ cell, cellRef, editing }: { cell: CheckCell; cellRef: CellRef; editing: boolean }) {
  const interact = useStore((s) => s.interact)
  const edit = useStore((s) => s.edit)
  const toggle = () => interact((n) => patchCell(n, cellRef, { checked: !cell.checked }))
  return (
    <div className="check" data-checked={cell.checked}>
      <button className="box" data-shape={cell.shape} role="checkbox" aria-checked={cell.checked} aria-label="Done" data-testid="check-box" onClick={toggle}>
        <CheckIcon size={16} />
      </button>
      <Leading cell={cell} />
      {editing ? (
        <TextEditor text={cell.text} cellRef={cellRef} onChange={(t) => edit((n) => patchCell(n, cellRef, { text: t }), 'text')} />
      ) : (
        // Tapping the words toggles it too, so the whole row is a big target.
        <span className="text" data-testid="check-text" onClick={toggle}>{cell.text}</span>
      )}
    </div>
  )
}

function ToggleBody({ cell, cellRef, editing }: { cell: ToggleCell; cellRef: CellRef; editing: boolean }) {
  const interact = useStore((s) => s.interact)
  const edit = useStore((s) => s.edit)
  const flip = () => interact((n) => patchCell(n, cellRef, { on: !cell.on }))
  return (
    <div className="toggle" data-on={cell.on}>
      <Leading cell={cell} />
      {editing ? (
        <TextEditor text={cell.text} cellRef={cellRef} onChange={(t) => edit((n) => patchCell(n, cellRef, { text: t }), 'text')} />
      ) : (
        <span className="text" data-testid="toggle-text" onClick={flip}>{cell.text}</span>
      )}
      <button className="switch" role="switch" aria-checked={cell.on} aria-label="Switch" data-testid="toggle-switch" onClick={flip}>
        <i />
      </button>
    </div>
  )
}

function RatingBody({ cell, cellRef, editing, selected }: W<RatingCell>) {
  const interact = useStore((s) => s.interact)
  const set = (n: number) => interact((note) => patchCell(note, cellRef, { value: toggleRating(cell.value, n) }))
  return (
    <div className="rating">
      <Caption cell={cell} cellRef={cellRef} editing={editing} selected={selected} />
      <div className="stars" role="radiogroup" aria-label="Rating" style={{ ['--max' as string]: cell.max }}>
        {Array.from({ length: cell.max }, (_, i) => (
          <button key={i} className="star" role="radio" aria-checked={cell.value === i + 1} aria-label={`${i + 1} of ${cell.max}`} data-testid={`star-${i + 1}`} data-on={i < cell.value} onClick={() => set(i + 1)}>
            <NamedIcon name={cell.symbol ?? 'star'} size={22} />
          </button>
        ))}
      </div>
    </div>
  )
}

function MoodBody({ cell, cellRef, editing, selected }: W<MoodCell>) {
  const interact = useStore((s) => s.interact)
  return (
    <div className="mood">
      <Caption cell={cell} cellRef={cellRef} editing={editing} selected={selected} />
      <div className="faces" role="radiogroup" aria-label="Mood">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            className="face"
            role="radio"
            aria-checked={cell.value === n}
            aria-label={MOODS[n - 1]}
            data-testid={`mood-${n}`}
            data-level={n}
            data-on={cell.value === n}
            onClick={() => interact((note) => patchCell(note, cellRef, { value: toggleMood(cell.value, n) }))}
          >
            <MoodFace level={n} />
          </button>
        ))}
      </div>
      <button
        className="face-cycle"
        aria-label={cell.value ? MOODS[cell.value - 1] : 'Mood'}
        data-testid="mood-cycle"
        data-level={cell.value || undefined}
        onClick={() => interact((note) => patchCell(note, cellRef, { value: (cell.value + 1) % 6 }))}
      >
        <MoodFace level={cell.value || 3} />
      </button>
    </div>
  )
}

// Dragging sets the value. The draft lives in this component, so a drag never touches the
// note (or storage) until you let go; that is what keeps it smooth.
function useDragValue(value: number, commit: (v: number) => void) {
  const [draft, setDraft] = useState<number | null>(null)
  const ref = useRef<number | null>(null)
  const set = (v: number) => {
    ref.current = clampProgress(v)
    setDraft(ref.current)
  }
  const end = () => {
    if (ref.current !== null) commit(ref.current)
    ref.current = null
    setDraft(null)
  }
  return { shown: draft ?? value, dragging: draft !== null, set, end }
}

function ProgressBody({ cell, cellRef, editing, selected }: W<ProgressCell>) {
  const interact = useStore((s) => s.interact)
  const box = useRef<HTMLDivElement>(null)
  const drag = useDragValue(cell.value, (v) => interact((n) => patchCell(n, cellRef, { value: v })))
  const ring = cell.shape === 'ring'
  const fromPointer = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect()
    if (ring) drag.set(ringValue(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)))
    else drag.set(((e.clientX - r.left) / r.width) * 100)
  }
  const handlers = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      fromPointer(e)
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => e.currentTarget.hasPointerCapture(e.pointerId) && fromPointer(e),
    onPointerUp: () => drag.end(),
    onPointerCancel: () => drag.end(),
    onKeyDown: (e: React.KeyboardEvent) => {
      const step = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 5 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -5 : 0
      if (!step) return
      e.preventDefault()
      interact((n) => patchCell(n, cellRef, { value: clampProgress(cell.value + step) }))
    },
  }
  const aria = { role: 'slider', tabIndex: 0, 'aria-label': 'Progress', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': drag.shown }
  if (ring) {
    return (
      <div className="progress ring" data-dragging={drag.dragging}>
        <Caption cell={cell} cellRef={cellRef} editing={editing} selected={selected} />
        <div ref={box} className="dial" data-testid="progress-track" {...aria} {...handlers}>
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle className="bed" cx="50" cy="50" r="42" />
            <circle className="arc" cx="50" cy="50" r="42" pathLength="100" strokeDasharray={`${drag.shown} 100`} />
          </svg>
          <span className="pct" data-testid="progress-value">{drag.shown}%</span>
        </div>
      </div>
    )
  }
  return (
    <div className="progress" data-dragging={drag.dragging}>
      <div className="head">
        <Caption cell={cell} cellRef={cellRef} editing={editing} selected={selected} />
        <span className="pct" data-testid="progress-value">{drag.shown}%</span>
      </div>
      <div ref={box} className="track" data-testid="progress-track" style={{ ['--v' as string]: drag.shown / 100 }} {...aria} {...handlers}>
        <div className="fill" />
        <div className="knob" />
      </div>
    </div>
  )
}

function HabitBody({ cell, cellRef, editing, selected }: W<HabitCell>) {
  const interact = useStore((s) => s.interact)
  return (
    <div className="habit" data-shape={cell.shape}>
      <div className="head">
        <Caption cell={cell} cellRef={cellRef} editing={editing} selected={selected} />
        <span className="tally" data-testid="habit-count">{habitCount(cell.days)}/7</span>
      </div>
      <div className="days">
        {HABIT_DAYS.map((d, i) => (
          <button
            key={i}
            className="day"
            aria-pressed={cell.days[i]}
            aria-label={`Day ${i + 1}`}
            data-testid={`day-${i + 1}`}
            onClick={() => interact((n) => patchCell(n, cellRef, { days: toggleDay(cell.days, i) }))}
          >
            <i />
            <span>{d}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function PipsBody({ cell, cellRef, editing, selected }: W<PipsCell>) {
  const interact = useStore((s) => s.interact)
  return (
    <div className="pips">
      <div className="head">
        <Caption cell={cell} cellRef={cellRef} editing={editing} selected={selected} />
        <span className="tally" data-testid="pips-count">{cell.value}/{cell.max}</span>
      </div>
      <div className="dots" role="group" aria-label="Progress in steps">
        {Array.from({ length: cell.max }, (_, i) => (
          <button
            key={i}
            className="pip"
            aria-pressed={i < cell.value}
            aria-label={`Step ${i + 1}`}
            data-testid={`pip-${i + 1}`}
            onClick={() => interact((n) => patchCell(n, cellRef, { value: setPips(cell.value, i + 1) }))}
          />
        ))}
      </div>
    </div>
  )
}

function TimeBody({ cell, cellRef, editing, selected }: W<TimeCell>) {
  const interact = useStore((s) => s.interact)
  const clk = formatClock(cell.value)
  return (
    <div className="time" data-empty={!clk}>
      <Caption cell={cell} cellRef={cellRef} editing={editing} selected={selected} />
      <div className="clock">
        {clk ? (
          <>
            <strong data-testid="time-value">{clk.hm}</strong>
            <span className="ap">{clk.ap}</span>
          </>
        ) : (
          <span className="ph" data-testid="time-value">Set time</span>
        )}
      </div>
      <input
        className="date-input"
        type="time"
        aria-label="Time"
        data-testid="time-input"
        value={cell.value}
        onChange={(e) => interact((n) => patchCell(n, cellRef, { value: e.target.value }))}
      />
    </div>
  )
}

function LinkBody({ cell, cellRef, editing }: { cell: LinkCell; cellRef: CellRef; editing: boolean }) {
  const edit = useStore((s) => s.edit)
  const href = normalizeUrl(cell.url)
  if (editing) {
    return (
      <div className="link">
        <LinkIcon size={18} />
        <TextEditor text={cell.text} cellRef={cellRef} onChange={(t) => edit((n) => patchCell(n, cellRef, { text: t }), 'text')} />
      </div>
    )
  }
  const label = linkLabel(cell.url, cell.text)
  return href ? (
    <a className="link" data-testid="link" href={href} target="_blank" rel="noopener noreferrer">
      <LinkIcon size={18} />
      <span className="text">{label}</span>
    </a>
  ) : (
    <span className="link" data-testid="link" data-empty="true">
      <LinkIcon size={18} />
      <span className="text">{label}</span>
    </span>
  )
}

function BadgeBody({ cell, cellRef, editing, selected }: W<BadgeCell>) {
  return (
    <div className="badge">
      <Caption cell={cell} cellRef={cellRef} editing={editing} selected={selected} />
      <span className="glyph" data-testid="badge-icon"><NamedIcon name={cell.icon} size={64} /></span>
    </div>
  )
}

// Bars are set by pressing or dragging inside the plot. Like the progress bar, the draft stays
// in the component and the note is written once on release.
function BarsBody({ cell, cellRef, editing, selected }: W<BarsCell>) {
  const interact = useStore((s) => s.interact)
  const plot = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<number[] | null>(null)
  const live = useRef<number[] | null>(null)
  const values = draft ?? cell.values
  const n = values.length
  const step = Math.max(1, Math.round(cell.max / 20))
  const at = (e: React.PointerEvent) => {
    const r = plot.current!.getBoundingClientRect()
    const i = Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left) / r.width) * n)))
    live.current = setBar(live.current ?? values, i, barHeight(e.clientY, r.top, r.height, cell.max, step))
    setDraft(live.current)
  }
  const end = () => {
    if (live.current) {
      const v = live.current
      interact((note) => patchCell(note, cellRef, { values: v }))
    }
    live.current = null
    setDraft(null)
  }
  return (
    <div className="bars" data-dragging={draft !== null}>
      <Caption cell={cell} cellRef={cellRef} editing={editing} selected={selected} />
      <div
        ref={plot}
        className="plot"
        role="group"
        aria-label="Bars"
        data-testid="bars-plot"
        style={{ ['--n' as string]: n }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          at(e)
        }}
        onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && at(e)}
        onPointerUp={end}
        onPointerCancel={end}
      >
        {values.map((v, i) => (
          <div key={i} className="bar" data-testid={`bar-${i + 1}`} data-value={v} style={{ ['--h' as string]: v / cell.max }}>
            <i />
          </div>
        ))}
      </div>
      {cell.axis === 'week' && (
        <div className="axis" aria-hidden="true">
          {HABIT_DAYS.map((d, i) => <span key={i}>{d}</span>)}
        </div>
      )}
    </div>
  )
}

function TagBody({ cell, cellRef }: { cell: TagCell; cellRef: CellRef }) {
  const interact = useStore((s) => s.interact)
  return (
    <button
      className="tag"
      data-testid="tag"
      data-tone={tagTone(cell.options, cell.value)}
      onClick={() => interact((n) => patchCell(n, cellRef, { value: nextTag(cell.options, cell.value) }))}
    >
      <i aria-hidden="true" />
      {cell.value}
    </button>
  )
}

function DatePicker({ value, cellRef }: { value: string; cellRef: CellRef }) {
  const interact = useStore((s) => s.interact)
  return (
    <input
      className="date-input"
      type="date"
      aria-label="Date"
      data-testid="date-input"
      value={value}
      onChange={(e) => interact((n) => patchCell(n, cellRef, { value: e.target.value }))}
    />
  )
}

function DateBody({ cell, cellRef, editing, selected }: W<DateCell>) {
  const parts = describeDate(cell.value, Date.now())
  return (
    <div className="date" data-empty={!parts}>
      <Caption cell={cell} cellRef={cellRef} editing={editing} selected={selected} />
      <div className="when">
        <span className="wd">{parts?.weekday ?? ''}</span>
        <strong data-testid="date-value">{parts?.main ?? 'Pick a date'}</strong>
        <span className="rel">{parts?.relative ?? ''}</span>
      </div>
      <DatePicker value={cell.value} cellRef={cellRef} />
    </div>
  )
}

function CountdownBody({ cell, cellRef, editing, selected }: W<CountdownCell>) {
  const c = describeCountdown(cell.value, Date.now())
  return (
    <div className="countdown" data-empty={!c} data-today={c?.days === 0 && c.caption === 'today'}>
      <Caption cell={cell} cellRef={cellRef} editing={editing} selected={selected} />
      {c ? (
        <div className="count">
          <strong data-testid="countdown-days">{c.caption === 'today' ? 'Today' : c.days}</strong>
          {c.caption !== 'today' && <span data-testid="countdown-caption">{c.caption}</span>}
        </div>
      ) : (
        <div className="count"><span data-testid="countdown-caption">Pick a date</span></div>
      )}
      <DatePicker value={cell.value} cellRef={cellRef} />
    </div>
  )
}
