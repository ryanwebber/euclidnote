import { describe, expect, it } from 'vitest'
import { FormatError, parseNote, serializeNote } from './format'
import { STARTER } from './starter'

describe('parseNote', () => {
  it('reads loose cells and groups', () => {
    const note = parseNote(STARTER)
    expect(note.columns).toEqual(['2fr', '1fr', '1fr'])
    expect(note.cells).toEqual([
      { x: 0, y: 0, cell: { type: 'text', text: 'Leg day', style: { bold: true }, span: 3 } },
    ])
    expect(note.groups[0]).toMatchObject({ x: 0, y: 1, variant: 'stack' })
    expect(note.groups[0].rows).toHaveLength(2)
  })

  it('treats bare values as text cells', () => {
    const note = parseNote('groups:\n  - at: [0, 0]\n    rows:\n      - [Driver, 250, ~]\n')
    expect(note.groups[0].rows[0]).toEqual([
      { type: 'text', text: 'Driver' },
      { type: 'text', text: '250' },
      { type: 'text', text: '' },
    ])
  })

  it('defaults title, flow, variant and infers the columns from the content', () => {
    const note = parseNote('groups:\n  - at: [0, 0]\n    rows:\n      - [a, b, c]\n')
    expect(note.title).toBe('Untitled')
    expect(note.flow).toBe('down')
    expect(note.groups[0].variant).toBe('plain')
    expect(note.columns).toEqual(['1fr', '1fr', '1fr'])
  })

  it('pads a column template that is shorter than the content', () => {
    const note = parseNote('columns: [2fr]\ngroups:\n  - at: [0, 0]\n    rows:\n      - [a, b]\n')
    expect(note.columns).toEqual(['2fr', '1fr'])
  })

  it('rejects bad input with a message naming the path', () => {
    expect(() => parseNote('flow: sideways\n')).toThrow(FormatError)
    expect(() => parseNote('groups:\n  - at: [0, 0]\n    variant: nope\n    rows: []\n')).toThrow(/groups\[0\]\.variant/)
    expect(() => parseNote('cells:\n  - {text: hi}\n')).toThrow(/cells\[0\]\.at/)
    expect(() => parseNote('cells:\n  - {at: [0, -1], text: hi}\n')).toThrow(/at must be/)
    expect(() => parseNote('groups:\n  - at: [0, 0]\n    rows:\n      - [{text: a, timer: 0}]\n')).toThrow(/exactly one of/)
  })

  it('rejects overlapping items', () => {
    expect(() => parseNote('cells:\n  - {at: [0, 0], span: 2, text: a}\n  - {at: [1, 0], text: b}\n')).toThrow(/overlap/)
  })

  it('rejects ragged group rows', () => {
    expect(() => parseNote('groups:\n  - at: [0, 0]\n    rows:\n      - [a, b]\n      - [c]\n')).toThrow(/same number of columns/)
  })
})

describe('the axis that fits the screen is capped by flow', () => {
  const wide = 'groups:\n  - at: [0, 0]\n    rows:\n      - [a, b, c, d, e, f]\n'
  const tall = `groups:\n  - at: [0, 0]\n    rows:\n${'      - [a]\n'.repeat(6)}`

  it('down notes cap columns, not rows', () => {
    expect(() => parseNote(wide)).toThrow(/at most 5 columns/)
    expect(parseNote(tall).groups[0].rows).toHaveLength(6)
  })

  it('right notes cap rows, not columns', () => {
    expect(() => parseNote(`flow: right\n${tall}`)).toThrow(/at most 5 rows/)
    expect(parseNote(`flow: right\n${wide}`).columns).toHaveLength(6)
  })
})

describe('serializeNote', () => {
  it('round-trips the starter note', () => {
    const note = parseNote(STARTER)
    expect(parseNote(serializeNote(note))).toEqual(note)
  })

  it('round-trips a right-flow note with several groups', () => {
    const note = parseNote(
      'flow: right\ncolumns: [1fr, 2fr]\ncells:\n  - {at: [0, 0], text: Hi}\ngroups:\n  - at: [1, 0]\n    variant: grid\n    rows:\n      - [a, {counter: 2, step: 5}]\n',
    )
    const out = serializeNote(note)
    expect(out).toContain('flow: right')
    expect(parseNote(out)).toEqual(note)
  })

  it('round-trips spans, styles and running timers', () => {
    const note = parseNote(
      'groups:\n  - at: [0, 0]\n    rows:\n      - [{text: Hi, italic: true, align: center, span: 2}]\n      - [{timer: 500, since: 1000}, {counter: 3, step: 5}]\n',
    )
    expect(parseNote(serializeNote(note))).toEqual(note)
  })

  it('omits the default flow and writes unstyled text as bare strings', () => {
    const out = serializeNote(parseNote('groups:\n  - at: [0, 0]\n    rows:\n      - [a, b]\n'))
    expect(out).not.toContain('flow:')
    expect(out).not.toContain('text:')
  })
})

describe('size and fill', () => {
  it('round-trip, and bad values are rejected', () => {
    const note = parseNote('cells:\n  - {at: [0, 0], text: Hi, size: title, fill: green}\n')
    expect(note.cells[0].cell.style).toEqual({ size: 'title', fill: 'green' })
    expect(parseNote(serializeNote(note))).toEqual(note)
    expect(() => parseNote('cells:\n  - {at: [0, 0], text: Hi, size: huge}\n')).toThrow(/size must be one of/)
    expect(() => parseNote('cells:\n  - {at: [0, 0], text: Hi, fill: mauve}\n')).toThrow(/fill must be one of/)
  })
})

describe('widgets', () => {
  const all = `title: W
columns: [1fr, 1fr]
groups:
  - at: [0, 0]
    variant: card
    fill: blue
    rows:
      - [{check: true, text: Milk}, {check: false}]
      - [{rating: 3}, {rating: 2, max: 10, label: Taste}]
      - [{progress: 40, label: Done}, {tag: Doing}]
      - [{tag: Open, options: [Open, Closed]}, {date: 2026-10-23}]
      - [{counter: 3, goal: 10, label: Sets}, {timer: 1500, label: Rest}]
`

  it('reads every widget', () => {
    const rows = parseNote(all).groups[0].rows
    expect(rows[0]).toEqual([{ type: 'check', checked: true, text: 'Milk' }, { type: 'check', checked: false, text: '' }])
    expect(rows[1]).toEqual([{ type: 'rating', value: 3, max: 5 }, { type: 'rating', value: 2, max: 10, label: 'Taste' }])
    expect(rows[2]).toEqual([
      { type: 'progress', value: 40, label: 'Done' },
      { type: 'tag', value: 'Doing', options: ['To do', 'Doing', 'Done'] },
    ])
    expect(rows[3]).toEqual([{ type: 'tag', value: 'Open', options: ['Open', 'Closed'] }, { type: 'date', value: '2026-10-23' }])
    expect(rows[4]).toEqual([
      { type: 'counter', value: 3, step: 1, goal: 10, label: 'Sets' },
      { type: 'timer', ms: 1500, since: null, label: 'Rest' },
    ])
    expect(parseNote(all).groups[0].fill).toBe('blue')
  })

  it('round-trips every widget', () => {
    const note = parseNote(all)
    expect(parseNote(serializeNote(note))).toEqual(note)
  })

  it('does not write default tag options or a default rating max', () => {
    const out = serializeNote(parseNote(all))
    expect(out).not.toContain('max: 5')
    expect(out.match(/options/g)).toHaveLength(1)
  })

  it('rejects out-of-range and mixed values', () => {
    const one = (cell: string) => `groups:\n  - at: [0, 0]\n    rows:\n      - [${cell}]\n`
    expect(() => parseNote(one('{rating: 7}'))).toThrow(/rating must be/)
    expect(() => parseNote(one('{progress: 140}'))).toThrow(/from 0 to 100/)
    expect(() => parseNote(one('{date: tomorrow}'))).toThrow(/date must look like/)
    expect(() => parseNote(one('{check: yes please}'))).toThrow(/check must be/)
    expect(() => parseNote(one('{tag: A, options: []}'))).toThrow(/options/)
    expect(() => parseNote(one('{counter: 1, rating: 2}'))).toThrow(/exactly one of/)
    expect(() => parseNote(one('{text: a, rating: 2}'))).toThrow(/exactly one of/)
  })
})

describe('text styling and looks', () => {
  it('reads and writes every style key', () => {
    const src = 'cells:\n  - {at: [0, 0], text: Hi, bold: true, italic: true, underline: true, strike: true, align: center, size: large, font: mono, border: dashed, icon: star, color: red, fill: yellow}\n'
    const note = parseNote(src)
    expect(note.cells[0].cell.style).toEqual({
      bold: true, italic: true, underline: true, strike: true, align: 'center', size: 'large',
      font: 'mono', border: 'dashed', icon: 'star', color: 'red', fill: 'yellow',
    })
    expect(parseNote(serializeNote(note))).toEqual(note)
    expect(() => parseNote('cells:\n  - {at: [0, 0], text: x, font: comic}\n')).toThrow(/font must be one of/)
    expect(() => parseNote('cells:\n  - {at: [0, 0], text: x, icon: nope}\n')).toThrow(/icon must be one of/)
  })

  it('every group look is accepted, and the old names still work', () => {
    for (const v of ['plain', 'card', 'table', 'header', 'sidebar', 'stripe', 'stack', 'tiles', 'outline']) {
      expect(parseNote(`groups:\n  - at: [0, 0]\n    variant: ${v}\n    rows:\n      - [a]\n`).groups[0].variant).toBe(v)
    }
    expect(parseNote('groups:\n  - at: [0, 0]\n    variant: grid\n    rows:\n      - [a]\n').groups[0].variant).toBe('table')
    expect(parseNote('groups:\n  - at: [0, 0]\n    variant: cards\n    rows:\n      - [a]\n').groups[0].variant).toBe('stack')
    expect(() => parseNote('groups:\n  - at: [0, 0]\n    variant: neon\n    rows:\n      - [a]\n')).toThrow(/variant must be/)
  })
})

describe('round 3 widgets and looks', () => {
  const src = `title: N
columns: [1fr, 1fr]
groups:
  - at: [0, 0]
    variant: header
    rows:
      - [{toggle: true, text: Wifi}, {number: 12.5, unit: kg, label: Weight}]
      - [{mood: 4, label: Today}, {habit: [1, 1, 0, 1, 0, 0, 0], label: Run}]
      - [{countdown: 2026-12-25, label: Xmas}, {progress: 60, shape: ring, label: Goal}]
      - [{number: ~}, {mood: 0}]
`

  it('reads the new widgets', () => {
    const rows = parseNote(src).groups[0].rows
    expect(rows[0]).toEqual([{ type: 'toggle', on: true, text: 'Wifi' }, { type: 'number', value: 12.5, unit: 'kg', label: 'Weight' }])
    expect(rows[1]).toEqual([{ type: 'mood', value: 4, label: 'Today' }, { type: 'habit', days: [true, true, false, true, false, false, false], label: 'Run' }])
    expect(rows[2]).toEqual([{ type: 'countdown', value: '2026-12-25', label: 'Xmas' }, { type: 'progress', value: 60, shape: 'ring', label: 'Goal' }])
    expect(rows[3]).toEqual([{ type: 'number', value: null }, { type: 'mood', value: 0 }])
  })

  it('round-trips them', () => {
    const note = parseNote(src)
    expect(parseNote(serializeNote(note))).toEqual(note)
  })

  it('rejects bad values', () => {
    const one = (cell: string) => `groups:\n  - at: [0, 0]\n    rows:\n      - [${cell}]\n`
    expect(() => parseNote(one('{mood: 9}'))).toThrow(/mood must be/)
    expect(() => parseNote(one('{habit: [1, 0]}'))).toThrow(/7 days/)
    expect(() => parseNote(one('{number: lots}'))).toThrow(/number must be/)
    expect(() => parseNote(one('{countdown: soon}'))).toThrow(/countdown must look like/)
    expect(() => parseNote(one('{progress: 5, shape: square}'))).toThrow(/shape must be/)
    expect(() => parseNote(one('{toggle: maybe}'))).toThrow(/toggle must be/)
  })

  it('accepts the new looks and fills, and maps retired looks onto them', () => {
    for (const v of ['plain', 'card', 'table', 'header', 'sidebar', 'stripe', 'stack', 'tiles', 'outline']) {
      expect(parseNote(`groups:\n  - at: [0, 0]\n    variant: ${v}\n    rows:\n      - [a]\n`).groups[0].variant).toBe(v)
    }
    const alias = (v: string) => parseNote(`groups:\n  - at: [0, 0]\n    variant: ${v}\n    rows:\n      - [a]\n`).groups[0].variant
    expect([alias('list'), alias('banded'), alias('grid'), alias('cards')]).toEqual(['table', 'header', 'table', 'stack'])
    for (const f of ['pink', 'teal', 'lime', 'indigo', 'sand', 'ink']) {
      expect(parseNote(`cells:\n  - {at: [0, 0], text: x, fill: ${f}}\n`).cells[0].cell.style?.fill).toBe(f)
    }
    expect(parseNote('cells:\n  - {at: [0, 0], text: x, font: display}\n').cells[0].cell.style?.font).toBe('display')
  })
})

describe('round 4 widgets and options', () => {
  const src = `title: N
columns: [1fr, 1fr]
groups:
  - at: [0, 0]
    variant: tiles
    rows:
      - [{pips: 2, max: 4, label: Sets}, {time: 09:15, label: Flight}]
      - [{link: example.com/menu, text: Menu}, {badge: plane, label: Trip}]
      - [{bars: [3, 5, 2, 6, 4, 7, 1], max: 8, label: Steps}, {timer: 0, from: 90000, label: Rest}]
      - [{rating: 3, symbol: heart}, {check: true, text: Done, shape: square}]
      - [{number: 5, prefix: $, unit: k}, {habit: [1, 0, 1, 0, 0, 0, 0], shape: square}]
`

  it('reads them', () => {
    const rows = parseNote(src).groups[0].rows
    expect(rows[0]).toEqual([{ type: 'pips', value: 2, max: 4, label: 'Sets' }, { type: 'time', value: '09:15', label: 'Flight' }])
    expect(rows[1]).toEqual([{ type: 'link', url: 'example.com/menu', text: 'Menu' }, { type: 'badge', icon: 'plane', label: 'Trip' }])
    expect(rows[2]).toEqual([
      { type: 'bars', values: [3, 5, 2, 6, 4, 7, 1], max: 8, label: 'Steps' },
      { type: 'timer', ms: 0, since: null, from: 90000, label: 'Rest' },
    ])
    expect(rows[3]).toEqual([{ type: 'rating', value: 3, max: 5, symbol: 'heart' }, { type: 'check', checked: true, text: 'Done', shape: 'square' }])
    expect(rows[4]).toEqual([{ type: 'number', value: 5, prefix: '$', unit: 'k' }, { type: 'habit', days: [true, false, true, false, false, false, false], shape: 'square' }])
  })

  it('round-trips them', () => {
    const note = parseNote(src)
    expect(parseNote(serializeNote(note))).toEqual(note)
  })

  it('pads a one-digit hour and rejects nonsense', () => {
    const one = (cell: string) => `groups:\n  - at: [0, 0]\n    rows:\n      - [${cell}]\n`
    expect(parseNote(one('{time: "9:05"}')).groups[0].rows[0][0]).toEqual({ type: 'time', value: '09:05' })
    expect(() => parseNote(one('{time: "25:00"}'))).toThrow(/time must look like/)
    expect(() => parseNote(one('{pips: 9, max: 4}'))).toThrow(/pips must be/)
    expect(() => parseNote(one('{badge: nope}'))).toThrow(/badge must be one of/)
    expect(() => parseNote(one('{bars: [1]}'))).toThrow(/bars must be/)
    expect(() => parseNote(one('{bars: [1, 99], max: 10}'))).toThrow(/bars must be/)
    expect(() => parseNote(one('{rating: 1, symbol: nope}'))).toThrow(/symbol must be one of/)
  })

  it('every icon name is accepted for a style icon', () => {
    for (const name of ['home', 'car', 'bike', 'run', 'book', 'music', 'camera', 'mountain', 'users', 'ticket']) {
      expect(parseNote(`cells:\n  - {at: [0, 0], text: x, icon: ${name}}\n`).cells[0].cell.style?.icon).toBe(name)
    }
  })
})

describe('layout and chart axis', () => {
  it('round-trips a cell layout and a week chart', () => {
    const text = 'title: T\ncolumns: [1fr]\ncells:\n  - {at: [0, 0], counter: 2, layout: row}\n  - {at: [0, 1], bars: [1, 2, 3, 4, 5, 6, 7], max: 10, axis: week}\n'
    const note = parseNote(text)
    expect(note.cells[0].cell.style).toEqual({ layout: 'row' })
    expect(note.cells[1].cell).toMatchObject({ type: 'bars', axis: 'week' })
    expect(parseNote(serializeNote(note))).toEqual(note)
  })
  it('rejects a bad layout, and a week chart without seven bars', () => {
    expect(() => parseNote('cells:\n  - {at: [0, 0], counter: 1, layout: wide}\n')).toThrow(FormatError)
    expect(() => parseNote('cells:\n  - {at: [0, 0], bars: [1, 2, 3], axis: week}\n')).toThrow(FormatError)
  })
  it('a custom chart has no axis', () => {
    const note = parseNote('cells:\n  - {at: [0, 0], bars: [1, 2, 3], max: 5}\n')
    expect(note.cells[0].cell).not.toHaveProperty('axis')
  })
})

describe('format versions', () => {
  it('writes the version first, and reads notes with or without one', () => {
    const note = parseNote('title: V\ncolumns: [1fr]\n')
    const out = serializeNote(note)
    expect(out.startsWith('version: 1\n')).toBe(true)
    expect(parseNote(out)).toEqual(note)
    expect(parseNote('version: 1\ntitle: V\ncolumns: [1fr]\n')).toEqual(note)
  })
  it('refuses a note from a newer version instead of misreading it', () => {
    expect(() => parseNote('version: 2\ntitle: V\n')).toThrow(/newer version/)
  })
  it('refuses a version that makes no sense', () => {
    for (const v of ['0', '1.5', 'two', '-1']) expect(() => parseNote(`version: ${v}\ntitle: V\n`)).toThrow(FormatError)
  })
})
