import { type ReactNode, useEffect, useState } from 'react'
import {
  canSetFlow,
  deleteColumn,
  equalizeColumns,
  getCell,
  insertCell,
  insertColumnAt,
  insertGroup,
  insertHeading,
  patchCell,
  patchStyle,
  setCellType,
  setColumnWeight,
  setFlow,
  setGroupFill,
  setGroupVariant,
} from '../model/ops'
import {
  type Align,
  BORDERS,
  type Layout,
  type Border,
  type Cell,
  type CellType,
  FILLS,
  type Fill,
  type Font,
  ICON_NAMES,
  type Note,
  type Selection,
  VARIANTS,
  type Variant,
} from '../model/types'
import { columnWeight } from '../model/ops'
import { useStore } from '../store'
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BadgeIcon,
  BarsIcon,
  CheckboxIcon,
  CountdownIcon,
  CounterIcon,
  HabitIcon,
  HeadingIcon,
  LinkIcon,
  PipsIcon,
  TimeIcon,
  MoodIcon,
  NumberIcon,
  ToggleIcon,
  NamedIcon,
  ProgressIcon,
  TagIcon,
  TextIcon,
  TimerIcon,
  XIcon,
} from './icons'

const LOOK_NAMES: Record<Variant, string> = {
  plain: 'Plain', card: 'Card', table: 'Table', header: 'Header', sidebar: 'Sidebar', stripe: 'Stripe', stack: 'Stack', tiles: 'Tiles', outline: 'Outline',
}
export const TYPE_NAMES: Record<CellType, string> = {
  text: 'Text', check: 'Checkbox', toggle: 'Switch', counter: 'Counter', number: 'Number', timer: 'Timer', rating: 'Rating',
  mood: 'Mood', progress: 'Progress', habit: 'Habit', tag: 'Tag', date: 'Date', countdown: 'Countdown',
  link: 'Link', badge: 'Badge', pips: 'Steps', bars: 'Chart', time: 'Time',
}

// A miniature of how a look draws a group, built from the same CSS the note uses.
export function LookPreview({ variant }: { variant: Variant }) {
  return (
    <span className="lp" data-variant={variant} aria-hidden="true">
      {[0, 1, 2].map((r) => (
        <span key={r} className="lp-row" data-first={r === 0}>
          <i />
          <i />
        </span>
      ))}
    </span>
  )
}

function TypeIcon({ type }: { type: CellType }) {
  switch (type) {
    case 'text': return <TextIcon />
    case 'check': return <CheckboxIcon />
    case 'counter': return <CounterIcon />
    case 'timer': return <TimerIcon />
    case 'rating': return <NamedIcon name="star" size={22} />
    case 'progress': return <ProgressIcon />
    case 'tag': return <TagIcon />
    case 'date': return <NamedIcon name="calendar" size={22} />
    case 'toggle': return <ToggleIcon />
    case 'number': return <NumberIcon />
    case 'mood': return <MoodIcon />
    case 'habit': return <HabitIcon />
    case 'countdown': return <CountdownIcon />
    case 'link': return <LinkIcon />
    case 'badge': return <BadgeIcon />
    case 'pips': return <PipsIcon />
    case 'bars': return <BarsIcon />
    case 'time': return <TimeIcon />
  }
}

const Tile = ({ id, label, icon, on, onClick }: { id: string; label: string; icon: ReactNode; on?: boolean; onClick: () => void }) => (
  <button className="tile" data-testid={id} aria-pressed={on} onClick={onClick}>
    <span className="tile-art">{icon}</span>
    <span className="tile-label">{label}</span>
  </button>
)

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="sheet-section">
    <h3>{title}</h3>
    {children}
  </section>
)

function Swatches({ value, onPick, prefix, none = true }: { value?: Fill; onPick: (f?: Fill) => void; prefix: string; none?: boolean }) {
  return (
    <div className="swatches">
      {none && <button data-testid={`${prefix}-none`} aria-label="None" aria-pressed={!value} className="swatch" data-fill="none" onClick={() => onPick(undefined)} />}
      {FILLS.map((f) => (
        <button key={f} data-testid={`${prefix}-${f}`} aria-label={f} aria-pressed={value === f} className="swatch" data-fill={f} onClick={() => onPick(f)} />
      ))}
    </div>
  )
}

function Seg<T extends string | undefined>({ options, value, onPick, prefix }: { options: { v: T; label: ReactNode; id: string; style?: React.CSSProperties }[]; value: T; onPick: (v: T) => void; prefix: string }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.id} data-testid={`${prefix}-${o.id}`} aria-pressed={value === o.v} style={o.style} onClick={() => onPick(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- sheets

export function AddSheet({ close }: { close: () => void }) {
  const { note, edit, select, startEditing } = useStore.getState()
  const add = (fn: (n: Note) => Note, pick: (n: Note) => Selection) => {
    const next = fn(note)
    if (next === note) return
    edit(() => next)
    const sel = pick(next)
    if (sel.kind === 'cell' && getCell(next, sel.ref)?.type === 'text') startEditing(sel.ref)
    else select(sel)
    close()
  }
  const lastCell = (n: Note): Selection => ({ kind: 'cell', ref: { in: 'loose', i: n.cells.length - 1 } })
  const lastGroup = (n: Note): Selection => ({ kind: 'group', g: n.groups.length - 1 })
  const cell = (type: CellType) => (
    <Tile key={type} id={`add-${type}`} label={TYPE_NAMES[type]} icon={<TypeIcon type={type} />} onClick={() => add((n) => insertCell(n, type), lastCell)} />
  )
  return (
    <>
      <Section title="Cells">
        <div className="tiles">
          <Tile id="add-heading" label="Heading" icon={<HeadingIcon />} onClick={() => add(insertHeading, lastCell)} />
          {cell('text')}
          {cell('check')}
          {cell('toggle')}
          {cell('number')}
          {cell('tag')}
          {cell('link')}
          {cell('badge')}
        </div>
      </Section>
      <Section title="Trackers">
        <div className="tiles">
          {cell('counter')}
          {cell('timer')}
          {cell('rating')}
          {cell('mood')}
          {cell('progress')}
          {cell('pips')}
          {cell('habit')}
          {cell('bars')}
        </div>
      </Section>
      <Section title="Dates">
        <div className="tiles">
          {cell('date')}
          {cell('time')}
          {cell('countdown')}
        </div>
      </Section>
      <Section title="Groups">
        <div className="tiles">
          {VARIANTS.map((v) => (
            <Tile key={v} id={`add-group-${v}`} label={LOOK_NAMES[v]} icon={<LookPreview variant={v} />} onClick={() => add((n) => insertGroup(n, v), lastGroup)} />
          ))}
        </div>
      </Section>
    </>
  )
}

export function LookSheet({ g }: { g: number }) {
  const { edit } = useStore.getState()
  const group = useStore((s) => s.note.groups[g])
  if (!group) return null
  return (
    <>
      <Section title="Look">
        <div className="tiles">
          {VARIANTS.map((v) => (
            <Tile key={v} id={`look-${v}`} label={LOOK_NAMES[v]} icon={<LookPreview variant={v} />} on={group.variant === v} onClick={() => edit((n) => setGroupVariant(n, g, v))} />
          ))}
        </div>
      </Section>
      <Section title="Tint">
        <Swatches value={group.fill} prefix="group-fill" onPick={(f) => edit((n) => setGroupFill(n, g, f))} />
      </Section>
    </>
  )
}

export function FormatSheet({ sel }: { sel: Extract<Selection, { kind: 'cell' }> }) {
  const { edit } = useStore.getState()
  const cell = useStore((s) => getCell(s.note, sel.ref))
  if (!cell) return null
  const st = cell.style ?? {}
  const set = (patch: Parameters<typeof patchStyle>[2]) => edit((n) => patchStyle(n, sel.ref, patch))
  const toggle = (k: 'bold' | 'italic' | 'underline' | 'strike') => set({ [k]: !st[k] })
  return (
    <>
      <Section title="Text">
        <div className="seg">
          <button data-testid="style-bold" aria-pressed={!!st.bold} onClick={() => toggle('bold')}><b>B</b></button>
          <button data-testid="style-italic" aria-pressed={!!st.italic} onClick={() => toggle('italic')}><i>I</i></button>
          <button data-testid="style-underline" aria-pressed={!!st.underline} onClick={() => toggle('underline')}><u>U</u></button>
          <button data-testid="style-strike" aria-pressed={!!st.strike} onClick={() => toggle('strike')}><s>S</s></button>
        </div>
        <Seg<Align>
          prefix="align"
          value={st.align ?? 'left'}
          onPick={(a) => set({ align: a })}
          options={[
            { v: 'left', id: 'left', label: <AlignLeftIcon size={18} /> },
            { v: 'center', id: 'center', label: <AlignCenterIcon size={18} /> },
            { v: 'right', id: 'right', label: <AlignRightIcon size={18} /> },
          ]}
        />
        <Seg<string | undefined>
          prefix="size"
          value={st.size}
          onPick={(s) => set({ size: s as never })}
          options={[
            { v: 'small', id: 'small', label: 'A', style: { fontSize: 12 } },
            { v: undefined, id: 'normal', label: 'A', style: { fontSize: 16 } },
            { v: 'large', id: 'large', label: 'A', style: { fontSize: 20 } },
            { v: 'title', id: 'title', label: 'A', style: { fontSize: 25 } },
          ]}
        />
      </Section>
      <Section title="Font">
        <Seg<Font | undefined>
          prefix="font"
          value={st.font}
          onPick={(f) => set({ font: f })}
          options={[
            { v: undefined, id: 'sans', label: 'Aa' },
            { v: 'serif', id: 'serif', label: 'Aa', style: { fontFamily: 'var(--font-serif)' } },
            { v: 'mono', id: 'mono', label: 'Aa', style: { fontFamily: 'var(--font-mono)' } },
            { v: 'rounded', id: 'rounded', label: 'Aa', style: { fontFamily: 'var(--font-rounded)', fontWeight: 700 } },
            { v: 'display', id: 'display', label: 'AA', style: { fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.02em' } },
          ]}
        />
      </Section>
      <Section title="Border">
        <Seg<Border | undefined>
          prefix="border"
          value={st.border}
          onPick={(b) => set({ border: b })}
          options={[
            { v: undefined, id: 'none', label: <XIcon size={16} /> },
            ...BORDERS.map((b) => ({ v: b as Border | undefined, id: b, label: <span className="border-sample" data-border={b} /> })),
          ]}
        />
      </Section>
      <Section title="Text color">
        <Swatches value={st.color} prefix="text-color" onPick={(c) => set({ color: c })} />
      </Section>
      <Section title="Icon">
        <div className="icons">
          <button data-testid="icon-none" aria-label="No icon" aria-pressed={!st.icon} onClick={() => set({ icon: undefined })}><XIcon size={16} /></button>
          {ICON_NAMES.map((name) => (
            <button key={name} data-testid={`icon-${name}`} aria-label={name} aria-pressed={st.icon === name} onClick={() => set({ icon: name })}>
              <NamedIcon name={name} size={20} />
            </button>
          ))}
        </div>
      </Section>
    </>
  )
}

export function FillSheet({ sel }: { sel: Extract<Selection, { kind: 'cell' }> }) {
  const { edit } = useStore.getState()
  const fill = useStore((s) => getCell(s.note, sel.ref)?.style?.fill)
  return <Swatches value={fill} prefix="fill" onPick={(f) => edit((n) => patchStyle(n, sel.ref, { fill: f }))} />
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function Settings({ cell, sel }: { cell: Cell; sel: Extract<Selection, { kind: 'cell' }> }) {
  const { edit } = useStore.getState()
  const patch = (p: Record<string, unknown>, key?: string) => edit((n) => patchCell(n, sel.ref, p), key)
  const number = (v: string) => (v.trim() === '' ? undefined : Number(v))
  const label = 'label' in cell ? (cell.label ?? '') : ''
  const showLabel = ['counter', 'timer', 'rating', 'progress', 'date', 'number', 'mood', 'habit', 'countdown', 'pips', 'time', 'badge', 'bars'].includes(cell.type)
  const layout = cell.style?.layout
  return (
    <Section title="Settings">
      {showLabel && (
        <Field label="Label">
          <input data-testid="setting-label" value={label} placeholder="None" onChange={(e) => patch({ label: e.target.value }, 'label')} />
        </Field>
      )}
      {showLabel && (
        <div className="field">
          <span>Layout</span>
          <Seg<Layout | undefined>
            prefix="layout"
            value={layout}
            onPick={(l) => edit((n) => patchStyle(n, sel.ref, { layout: l }))}
            options={[
              { v: undefined, id: 'auto', label: 'Auto' },
              { v: 'center', id: 'center', label: 'Center' },
              { v: 'start', id: 'start', label: 'Top' },
              { v: 'row', id: 'row', label: 'Row' },
            ]}
          />
        </div>
      )}
      {cell.type === 'counter' && (
        <>
          <Field label="Goal">
            <input data-testid="setting-goal" inputMode="numeric" value={cell.goal ?? ''} placeholder="None" onChange={(e) => { const n = number(e.target.value); if (n === undefined || Number.isFinite(n)) patch({ goal: n }, 'goal') }} />
          </Field>
          <Field label="Step">
            <input data-testid="setting-step" inputMode="numeric" value={cell.step} onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n !== 0) patch({ step: n }, 'step') }} />
          </Field>
        </>
      )}
      {cell.type === 'timer' && (
        <Field label="Count down from (s)">
          <input
            data-testid="setting-from"
            inputMode="numeric"
            value={cell.from === undefined ? '' : cell.from / 1000}
            placeholder="Count up"
            onChange={(e) => {
              const n = number(e.target.value)
              if (n === undefined) patch({ from: undefined, ms: 0, since: null })
              else if (Number.isFinite(n) && n > 0) patch({ from: Math.round(n * 1000), ms: 0, since: null })
            }}
          />
        </Field>
      )}
      {cell.type === 'rating' && (
        <>
          <div className="icons small">
            {(['star', 'heart', 'fire', 'bolt', 'sun', 'moon', 'dollar'] as const).map((name) => (
              <button key={name} data-testid={`symbol-${name}`} aria-label={name} aria-pressed={(cell.symbol ?? 'star') === name} onClick={() => patch({ symbol: name === 'star' ? undefined : name })}>
                <NamedIcon name={name} size={20} />
              </button>
            ))}
          </div>
        </>
      )}
      {cell.type === 'rating' && (
        <Field label="Stars">
          <input data-testid="setting-max" inputMode="numeric" value={cell.max} onChange={(e) => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 1 && n <= 10) patch({ max: n, value: Math.min(cell.value, n) }, 'max') }} />
        </Field>
      )}
      {cell.type === 'tag' && <TagOptions cell={cell} patch={patch} />}
      {cell.type === 'number' && (
        <>
          <Field label="Prefix">
            <input data-testid="setting-prefix" value={cell.prefix ?? ''} placeholder="None" onChange={(e) => patch({ prefix: e.target.value }, 'prefix')} />
          </Field>
          <Field label="Unit">
            <input data-testid="setting-unit" value={cell.unit ?? ''} placeholder="None" onChange={(e) => patch({ unit: e.target.value }, 'unit')} />
          </Field>
        </>
      )}
      {(cell.type === 'check' || cell.type === 'habit') && (
        <div className="seg">
          <button data-testid="shape-round" aria-pressed={cell.shape !== 'square'} onClick={() => patch({ shape: undefined })}>Round</button>
          <button data-testid="shape-square" aria-pressed={cell.shape === 'square'} onClick={() => patch({ shape: 'square' })}>Square</button>
        </div>
      )}
      {cell.type === 'pips' && (
        <Field label="Steps">
          <input data-testid="setting-max" inputMode="numeric" value={cell.max} onChange={(e) => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 2 && n <= 12) patch({ max: n, value: Math.min(cell.value, n) }, 'max') }} />
        </Field>
      )}
      {cell.type === 'bars' && (
        <>
          <Field label="Top of scale">
            <input data-testid="setting-scale" inputMode="numeric" value={cell.max} onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n > 0) patch({ max: n, values: cell.values.map((v) => Math.min(v, n)) }, 'scale') }} />
          </Field>
          <div className="seg">
            <button data-testid="chart-week" aria-pressed={cell.axis === 'week'} onClick={() => patch({ axis: 'week', values: Array.from({ length: 7 }, (_, i) => cell.values[i] ?? 0) })}>Week</button>
            <button data-testid="chart-custom" aria-pressed={cell.axis !== 'week'} onClick={() => patch({ axis: undefined })}>Custom</button>
          </div>
          {cell.axis !== 'week' && (
            <Field label="Bars">
              <input data-testid="setting-bars" inputMode="numeric" value={cell.values.length} onChange={(e) => {
                const n = Number(e.target.value)
                if (Number.isInteger(n) && n >= 2 && n <= 14) patch({ values: Array.from({ length: n }, (_, i) => cell.values[i] ?? 0) }, 'bars')
              }} />
            </Field>
          )}
        </>
      )}
      {cell.type === 'link' && (
        <Field label="Address">
          <input data-testid="setting-url" inputMode="url" autoCapitalize="none" value={cell.url} placeholder="example.com" onChange={(e) => patch({ url: e.target.value }, 'url')} />
        </Field>
      )}
      {cell.type === 'badge' && (
        <div className="icons">
          {ICON_NAMES.map((name) => (
            <button key={name} data-testid={`badge-${name}`} aria-label={name} aria-pressed={cell.icon === name} onClick={() => patch({ icon: name })}>
              <NamedIcon name={name} size={20} />
            </button>
          ))}
        </div>
      )}
      {cell.type === 'progress' && (
        <div className="seg">
          <button data-testid="shape-bar" aria-pressed={cell.shape !== 'ring'} onClick={() => patch({ shape: undefined })}>Bar</button>
          <button data-testid="shape-ring" aria-pressed={cell.shape === 'ring'} onClick={() => patch({ shape: 'ring' })}>Ring</button>
        </div>
      )}
      {(cell.type === 'date' || cell.type === 'countdown') && cell.value && (
        <button className="plain-btn" data-testid="setting-clear-date" onClick={() => patch({ value: '' })}>Clear date</button>
      )}
      {!showLabel && !['tag', 'check', 'link'].includes(cell.type) && <p className="pop-hint">Nothing to configure. Tap the words to edit them.</p>}
    </Section>
  )
}

function TagOptions({ cell, patch }: { cell: Cell & { type: 'tag' }; patch: (p: Record<string, unknown>) => void }) {
  const [text, setText] = useState(cell.options.join(', '))
  useEffect(() => setText(cell.options.join(', ')), [cell.options.join('|')])
  const commit = () => {
    const options = text.split(',').map((s) => s.trim()).filter(Boolean)
    if (options.length) patch({ options })
  }
  return (
    <Field label="Options">
      <input data-testid="setting-options" value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} />
    </Field>
  )
}

export function WidgetSheet({ sel }: { sel: Extract<Selection, { kind: 'cell' }> }) {
  const { edit } = useStore.getState()
  const cell = useStore((s) => getCell(s.note, sel.ref))
  if (!cell) return null
  return (
    <>
      <Section title="Type">
        <div className="tiles">
          {(Object.keys(TYPE_NAMES) as CellType[]).map((t) => (
            <Tile key={t} id={`type-${t}`} label={TYPE_NAMES[t]} icon={<TypeIcon type={t} />} on={cell.type === t} onClick={() => edit((n) => setCellType(n, sel.ref, t))} />
          ))}
        </div>
      </Section>
      <Settings cell={cell} sel={sel} />
    </>
  )
}

export function LayoutSheet() {
  const { edit } = useStore.getState()
  const note = useStore((s) => s.note)
  return (
    <>
      <Section title="Scroll direction">
        <div className="seg wide">
          <button data-testid="flow-down" aria-pressed={note.flow === 'down'} disabled={!canSetFlow(note, 'down')} onClick={() => edit((n) => setFlow(n, 'down'))}>↓ Down</button>
          <button data-testid="flow-right" aria-pressed={note.flow === 'right'} disabled={!canSetFlow(note, 'right')} onClick={() => edit((n) => setFlow(n, 'right'))}>→ Right</button>
        </div>
        {(!canSetFlow(note, 'down') || !canSetFlow(note, 'right')) && (
          <p className="pop-hint" data-testid="flow-hint">
            {note.flow === 'right'
              ? 'Down notes fit at most 5 columns across. Make the content narrower to switch.'
              : 'Right notes fit at most 5 rows tall. Make the content shorter to switch.'}
          </p>
        )}
      </Section>
    </>
  )
}

function ColumnMenu({ i, close }: { i: number; close: () => void }) {
  const { edit } = useStore.getState()
  const note = useStore((s) => s.note)
  const w = note.columns[i] ? columnWeight(note.columns[i]) : 1
  const item = (id: string, label: string, run: () => void, opts?: { disabled?: boolean; danger?: boolean; on?: boolean }) => (
    <li key={id}>
      <button data-testid={id} disabled={opts?.disabled} data-danger={opts?.danger} aria-pressed={opts?.on} onClick={() => { run(); close() }}>
        {label}
      </button>
    </li>
  )
  return (
    <ul className="menu">
      <li className="menu-title">Column {i + 1}</li>
      {item('col-whalf', '0.5x', () => edit((n) => setColumnWeight(n, i, 0.5)), { on: w === 0.5 })}
      {item('col-w1', '1x', () => edit((n) => setColumnWeight(n, i, 1)), { on: w === 1 })}
      {item('col-w2', '2x', () => edit((n) => setColumnWeight(n, i, 2)), { on: w === 2 })}
      {item('col-w3', '3x', () => edit((n) => setColumnWeight(n, i, 3)), { on: w === 3 })}
      <li className="rule" />
      {item('col-insert-left', 'Insert left', () => edit((n) => insertColumnAt(n, i)), { disabled: insertColumnAt(note, i) === note })}
      {item('col-insert-right', 'Insert right', () => edit((n) => insertColumnAt(n, i + 1)), { disabled: insertColumnAt(note, i + 1) === note })}
      {item('col-equal', 'Equal widths', () => edit(equalizeColumns))}
      <li className="rule" />
      {item('col-delete', 'Delete column', () => edit((n) => deleteColumn(n, i)), { disabled: note.columns.length <= 1, danger: true })}
    </ul>
  )
}

// ---------------------------------------------------------------- host

const TITLES: Record<string, string> = { add: 'Add', look: 'Group look', format: 'Style', fill: 'Fill', widget: 'Widget', layout: 'Layout' }

export function Popovers({ wide = false }: { wide?: boolean }) {
  const pop = useStore((s) => s.popover)
  const selected = useStore((s) => s.selected)
  const close = useStore((s) => s.closePopover)

  useEffect(() => {
    if (!pop) return
    const down = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('.popover, .tool, .col-tab')) close()
    }
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation() // closes the popover only; the selection stays
      close()
    }
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key, true)
    return () => {
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('keydown', key, true)
    }
  }, [pop, close])

  if (!pop) return null
  const cellSel = selected?.kind === 'cell' ? selected : null
  const menu = pop.id === 'column'
  // On large screens the inspector shows what the sheets would; only menus pop up.
  if (wide && !menu) return null
  let body: ReactNode = null
  if (pop.id === 'add') body = <AddSheet close={close} />
  else if (pop.id === 'look' && selected?.kind === 'group') body = <LookSheet g={selected.g} />
  else if (pop.id === 'format' && cellSel) body = <FormatSheet sel={cellSel} />
  else if (pop.id === 'fill' && cellSel) body = <FillSheet sel={cellSel} />
  else if (pop.id === 'widget' && cellSel) body = <WidgetSheet sel={cellSel} />
  else if (pop.id === 'layout') body = <LayoutSheet />
  else if (menu && pop.index !== undefined) body = <ColumnMenu i={pop.index} close={close} />
  if (!body) return null

  return (
    <>
    {/* The rest of the app dims while something is open. It does not block taps: tapping away still closes it. */}
    <div className="pop-scrim" data-testid="pop-scrim" aria-hidden="true" />
    <div
      className="popover"
      data-kind={menu ? 'menu' : pop.id === 'fill' ? 'small' : 'sheet'}
      data-placement={pop.placement}
      data-testid={`pop-${pop.id}`}
      role="dialog"
      aria-label={TITLES[pop.id] ?? 'Column'}
      style={{ ['--x' as string]: `${pop.x}px`, ['--y' as string]: `${pop.y}px` }}
    >
      {!menu && (
        <header className="sheet-head">
          <h2>{TITLES[pop.id]}</h2>
          <button className="sheet-close" aria-label="Close" data-testid="pop-close" onClick={close}><XIcon size={16} /></button>
        </header>
      )}
      <div className="sheet-body">{body}</div>
    </div>
    </>
  )
}

