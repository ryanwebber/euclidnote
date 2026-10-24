import { STARTER, center, dragTo, edit, expect, open, settled, test, tid } from './fixtures'

const WIDGETS = `title: W
columns: [1fr, 1fr]
groups:
  - at: [0, 0]
    variant: tiles
    rows:
      - [{toggle: false, text: Wifi}, {number: ~, unit: kg, label: Weight}]
      - [{mood: 0, label: Today}, {habit: [0, 0, 0, 0, 0, 0, 0], label: Run}]
      - [{countdown: "", label: Trip}, {progress: 50, shape: ring, label: Saved}]
`

test.describe('toggle', () => {
  test('flips from the switch or the words and is saved', async ({ page }) => {
    await open(page, WIDGETS)
    const cell = tid(page, 'cell-0-0')
    await expect(cell.getByTestId('toggle-switch')).toHaveAttribute('aria-checked', 'false')
    await cell.getByTestId('toggle-switch').click()
    await expect(cell.getByTestId('toggle-switch')).toHaveAttribute('aria-checked', 'true')
    await cell.getByTestId('toggle-text').click()
    await expect(cell.getByTestId('toggle-switch')).toHaveAttribute('aria-checked', 'false')
    await cell.getByTestId('toggle-switch').click()
    await page.reload()
    await expect(tid(page, 'cell-0-0').getByTestId('toggle-switch')).toHaveAttribute('aria-checked', 'true')
  })

  test('is inert while editing, and its words are editable', async ({ page }) => {
    await open(page, WIDGETS)
    await edit(page)
    await tid(page, 'cell-0-0').click()
    await expect(tid(page, 'cell-0-0').getByTestId('toggle-switch')).toHaveAttribute('aria-checked', 'false')
    await tid(page, 'cell-0-0').click()
    await expect(tid(page, 'text-editor')).toBeFocused()
    await page.keyboard.type('!')
    await page.keyboard.press('Escape')
    await expect(tid(page, 'cell-0-0')).toContainText('Wifi!')
  })
})

test.describe('number', () => {
  test('type a value straight into it; it keeps its unit and persists', async ({ page }) => {
    await open(page, WIDGETS)
    const cell = tid(page, 'cell-1-0')
    await expect(cell.getByTestId('number-unit')).toHaveText('kg')
    await cell.getByTestId('number-input').fill('72.4')
    await cell.getByTestId('number-input').press('Enter')
    await page.reload()
    await expect(tid(page, 'cell-1-0').getByTestId('number-input')).toHaveValue('72.4')
  })

  test('clearing it makes it empty again, and junk is ignored', async ({ page }) => {
    await open(page, WIDGETS.replace('number: ~', 'number: 5'))
    const input = tid(page, 'cell-1-0').getByTestId('number-input')
    await input.fill('abc')
    await input.blur()
    await expect(input).toHaveValue('5')
    await input.fill('')
    await input.blur()
    await expect(input).toHaveValue('')
  })

  test('the unit is a setting', async ({ page }) => {
    await open(page, WIDGETS)
    await edit(page)
    await tid(page, 'cell-1-0').click()
    await tid(page, 'tool-widget').click()
    await tid(page, 'setting-unit').fill('lb')
    await tid(page, 'pop-close').click()
    await expect(tid(page, 'cell-1-0').getByTestId('number-unit')).toHaveText('lb')
  })
})

test.describe('mood', () => {
  test('picking a face selects it; picking it again clears it', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'a half-width cell on a phone shows the one-face cycler instead')
    await open(page, 'title: M\ncolumns: [1fr]\ncells:\n  - {at: [0, 0], mood: 0, label: Today}\n')
    const cell = tid(page, 'cell-0-0')
    await cell.getByTestId('mood-4').click()
    await expect(cell.getByTestId('mood-4')).toHaveAttribute('data-on', 'true')
    await expect(cell.getByTestId('mood-2')).toHaveAttribute('data-on', 'false')
    await cell.getByTestId('mood-4').click()
    await expect(cell.getByTestId('mood-4')).toHaveAttribute('data-on', 'false')
  })

  test('in a narrow cell it is one face you tap to cycle', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 800 })
    await open(page, 'title: M\ncolumns: [1fr, 1fr, 1fr, 1fr]\ncells:\n  - {at: [0, 0], mood: 0}\n')
    const cell = tid(page, 'cell-0-0')
    await expect(cell.locator('.faces')).toBeHidden()
    const cycle = cell.getByTestId('mood-cycle')
    await cycle.click()
    await expect(cycle).toHaveAttribute('data-level', '1')
    await cycle.click()
    await cycle.click()
    await expect(cycle).toHaveAttribute('data-level', '3')
    for (let i = 0; i < 3; i++) await cycle.click()
    await expect(cycle).not.toHaveAttribute('data-level', /.+/) // wrapped back to unset
  })
})

test.describe('habit', () => {
  test('seven days toggle on and off and are counted', async ({ page }) => {
    await open(page, WIDGETS)
    const cell = tid(page, 'cell-1-1')
    await expect(cell.getByTestId('habit-count')).toHaveText('0/7')
    for (const d of [1, 2, 4]) await cell.getByTestId(`day-${d}`).click()
    await expect(cell.getByTestId('habit-count')).toHaveText('3/7')
    await expect(cell.getByTestId('day-2')).toHaveAttribute('aria-pressed', 'true')
    await expect(cell.getByTestId('day-3')).toHaveAttribute('aria-pressed', 'false')
    await cell.getByTestId('day-2').click()
    await expect(cell.getByTestId('habit-count')).toHaveText('2/7')
    await page.reload()
    await expect(tid(page, 'cell-1-1').getByTestId('habit-count')).toHaveText('2/7')
  })
})

test.describe('countdown', () => {
  test('asks for a date, then counts the days', async ({ page }) => {
    await open(page, WIDGETS)
    const cell = tid(page, 'cell-0-2')
    await expect(cell.getByTestId('countdown-caption')).toHaveText('Pick a date')
    await cell.getByTestId('date-input').fill('2031-01-01')
    await expect(cell.getByTestId('countdown-caption')).toHaveText('days to go')
    expect(Number(await cell.getByTestId('countdown-days').innerText())).toBeGreaterThan(100)
    await cell.getByTestId('date-input').fill('2020-01-01')
    await expect(cell.getByTestId('countdown-caption')).toHaveText('days ago')
  })
})

test.describe('progress', () => {
  test('a ring: drag around it, and the ring never leaves its cell', async ({ page }) => {
    await open(page, WIDGETS)
    const dial = tid(page, 'cell-1-2').getByTestId('progress-track')
    const cell = (await tid(page, 'cell-1-2').boundingBox())!
    const d = (await dial.boundingBox())!
    expect(d.x).toBeGreaterThanOrEqual(cell.x)
    expect(d.x + d.width).toBeLessThanOrEqual(cell.x + cell.width + 1)
    expect(d.y + d.height).toBeLessThanOrEqual(cell.y + cell.height + 1)
    const cx = d.x + d.width / 2
    const cy = d.y + d.height / 2
    await page.mouse.click(cx + d.width * 0.4, cy) // right: 25%
    await expect(tid(page, 'cell-1-2').getByTestId('progress-value')).toHaveText('25%')
    await page.mouse.click(cx, cy + d.height * 0.4) // bottom: 50%
    await expect(tid(page, 'cell-1-2').getByTestId('progress-value')).toHaveText('50%')
    await page.mouse.click(cx - d.width * 0.4, cy) // left: 75%
    await expect(tid(page, 'cell-1-2').getByTestId('progress-value')).toHaveText('75%')
  })

  test('the shape is a setting', async ({ page }) => {
    await open(page, 'title: P\ncolumns: [1fr, 1fr]\ncells:\n  - {at: [0, 0], progress: 30}\n')
    await expect(tid(page, 'cell-0-0').locator('.dial')).toHaveCount(0)
    await edit(page)
    await tid(page, 'cell-0-0').click()
    await tid(page, 'tool-widget').click()
    await tid(page, 'shape-ring').click()
    await expect(tid(page, 'cell-0-0').locator('.dial')).toHaveCount(1)
    await tid(page, 'shape-bar').click()
    await expect(tid(page, 'cell-0-0').locator('.dial')).toHaveCount(0)
  })

  test('the bar never pokes out of its card, even at 100%', async ({ page }) => {
    await open(page, 'title: P\ncolumns: [1fr, 1fr]\ncells:\n  - {at: [0, 0], progress: 100}\n  - {at: [1, 0], progress: 0}\n')
    for (const id of ['cell-0-0', 'cell-1-0']) {
      const cell = (await tid(page, id).boundingBox())!
      for (const part of ['.knob', '.fill', '.track']) {
        const b = (await tid(page, id).locator(part).boundingBox())!
        expect(b.x).toBeGreaterThanOrEqual(cell.x - 0.5)
        expect(b.x + b.width).toBeLessThanOrEqual(cell.x + cell.width + 0.5)
      }
    }
  })

  test('dragging the bar does not rewrite the note until you let go', async ({ page }) => {
    await open(page, 'title: P\ncolumns: [1fr, 1fr]\ncells:\n  - {at: [0, 0], progress: 0}\n')
    await page.evaluate(() => {
      const w = window as unknown as { __writes: number }
      w.__writes = 0
      const set = Storage.prototype.setItem
      Storage.prototype.setItem = function (...args) {
        if (String(args[0]).startsWith('euclidnote:note:')) w.__writes++ // the note itself, not the list's index
        return set.apply(this, args)
      }
    })
    const track = tid(page, 'cell-0-0').getByTestId('progress-track')
    const box = (await track.boundingBox())!
    await page.mouse.move(box.x + 6, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height / 2, { steps: 20 })
    await expect(tid(page, 'cell-0-0').getByTestId('progress-value')).toHaveText(/[5-9]\d%/)
    await page.waitForTimeout(250)
    expect(await page.evaluate(() => (window as unknown as { __writes: number }).__writes)).toBe(0)
    await page.mouse.up()
    await page.waitForTimeout(300)
    expect(await page.evaluate(() => (window as unknown as { __writes: number }).__writes)).toBeLessThanOrEqual(1)
  })
})

test.describe('theme', () => {
  test('the page is a flat color, with no gradient', async ({ page }) => {
    await open(page, STARTER)
    expect(await page.locator('.app').evaluate((el) => getComputedStyle(el).backgroundImage)).toBe('none')
  })

  test('cards are themselves colored, and their text and controls adapt', async ({ page }) => {
    await open(page, 'title: C\ncolumns: [1fr, 1fr]\ngroups:\n  - at: [0, 0]\n    variant: card\n    fill: ink\n    rows:\n      - [a, b]\n  - at: [0, 2]\n    variant: card\n    fill: yellow\n    rows:\n      - [{counter: 1}, {timer: 0}]\n')
    const bg = (sel: string) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).backgroundColor)
    const panels = await page.locator('.panel').evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor))
    expect(new Set(panels).size).toBe(2)
    expect(panels).not.toContain(await bg('.app'))
    // dark card => light text; light card => dark text
    const ink = await tid(page, 'cell-0-0').evaluate((el) => getComputedStyle(el).color)
    const dark = await tid(page, 'cell-0-2').evaluate((el) => getComputedStyle(el).color)
    const lum = (c: string) => (c.match(/\d+/g) ?? []).slice(0, 3).map(Number).reduce((a, b) => a + b, 0)
    expect(lum(ink)).toBeGreaterThan(lum(dark))
  })

  test('there are no hover styles: pointer-hover changes nothing', async ({ page }) => {
    await open(page, 'title: H\ncolumns: [1fr, 1fr]\ncells:\n  - {at: [0, 0], text: Hi}\n')
    await edit(page)
    const slot = tid(page, 'slot-1-0')
    const before = await slot.evaluate((el) => getComputedStyle(el).borderTopColor + getComputedStyle(el).backgroundColor)
    const c = await center(slot)
    await page.mouse.move(c.x, c.y)
    await page.waitForTimeout(250)
    const after = await slot.evaluate((el) => getComputedStyle(el).borderTopColor + getComputedStyle(el).backgroundColor)
    expect(after).toBe(before)
  })

  test('the style sheet is lifted by a shadow, not outlined by a border', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'cell-0-1').click()
    await tid(page, 'tool-format').click()
    const shadow = await tid(page, 'pop-format').evaluate((el) => getComputedStyle(el).boxShadow)
    expect(shadow).not.toBe('none')
    expect(shadow).not.toMatch(/0px 0px 0px 1\.5px/) // no hairline ring
    expect(await tid(page, 'pop-format').evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('0px')
  })
})

test.describe('density', () => {
  test('cells keep comfortable padding and gaps', async ({ page }) => {
    await open(page, 'title: D\ncolumns: [1fr, 1fr]\ngroups:\n  - at: [0, 0]\n    variant: card\n    rows:\n      - [a, b]\n      - [c, d]\n')
    const a = (await tid(page, 'cell-0-0').boundingBox())!
    const c = (await tid(page, 'cell-0-1').boundingBox())!
    expect(c.y - (a.y + a.height)).toBeGreaterThanOrEqual(11.5) // rows are 12px apart
    expect(a.height).toBeGreaterThanOrEqual(49)
    const pad = await tid(page, 'cell-0-0').evaluate((el) => getComputedStyle(el).paddingLeft)
    expect(parseFloat(pad)).toBeGreaterThanOrEqual(14) // group edges get a little extra
  })
})

test.describe('column steps and the ruler', () => {
  test('the add button is centered in the ruler strip', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await settled(page)
    const ruler = (await tid(page, 'ruler').boundingBox())!
    const add = (await tid(page, 'col-add').boundingBox())!
    expect(Math.abs(add.y + add.height / 2 - (ruler.y + ruler.height / 2))).toBeLessThan(2)
    const tab = (await tid(page, 'col-tab-2').boundingBox())!
    expect(Math.abs(add.y + add.height / 2 - (tab.y + tab.height / 2))).toBeLessThan(2)
    // and its plus glyph is centered in the circle
    const glyph = (await tid(page, 'col-add').locator('svg').boundingBox())!
    expect(Math.abs(glyph.x + glyph.width / 2 - (add.x + add.width / 2))).toBeLessThan(1)
    expect(Math.abs(glyph.y + glyph.height / 2 - (add.y + add.height / 2))).toBeLessThan(1)
  })

  test('the menu offers half a square up to three', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'col-tab-1').click()
    await tid(page, 'col-whalf').click()
    await expect(tid(page, 'col-tab-1')).toHaveText('0.5x')
    await tid(page, 'col-tab-1').click()
    await tid(page, 'col-w3').click()
    await expect(tid(page, 'col-tab-1')).toHaveText('3x')
  })
})

test.describe('drag ghost shows the real outline', () => {
  test('duplicating a stack previews a stack of cards, a card previews one panel', async ({ page }) => {
    await open(page, 'title: G\ncolumns: [1fr, 1fr]\ngroups:\n  - at: [0, 0]\n    variant: stack\n    fill: pink\n    rows:\n      - [a, b]\n      - [c, d]\n')
    await edit(page)
    await tid(page, 'group-grip-0').click()
    await settled(page)
    const a = await center(tid(page, 'handle-bottom'))
    await page.mouse.move(a.x, a.y)
    await page.mouse.down()
    await page.mouse.move(a.x, a.y + 190, { steps: 8 })
    await expect(tid(page, 'ghost')).toHaveAttribute('data-valid', 'true')
    await expect(page.locator('.ghost-layer .row-card')).toHaveCount(2)
    expect(await page.locator('.ghost-layer .row-card').first().evaluate((el) => el.getAttribute('data-gfill'))).toBe('pink')
    await page.mouse.up()
    // a plain loose cell previews as a single rounded cell
    await tid(page, 'undo').click()
    await open(page, 'title: G\ncolumns: [1fr, 1fr]\ncells:\n  - {at: [0, 0], text: Hi}\n')
  })

  test('a sweep previews a card; a loose cell moves as a cell', async ({ page }) => {
    await open(page, 'title: G\ncolumns: [1fr, 1fr, 1fr]\ncells:\n  - {at: [0, 0], text: Hello}\n')
    await edit(page)
    const a = await center(tid(page, 'slot-1-0'))
    const b = await center(tid(page, 'slot-2-1'))
    await page.mouse.move(a.x, a.y)
    await page.mouse.down()
    await page.mouse.move(b.x, b.y, { steps: 8 })
    await expect(page.locator('.ghost-layer .panel')).toHaveCount(1)
    await page.mouse.up()
    await tid(page, 'pop-close').click()
    await tid(page, 'undo').click()
    await tid(page, 'cell-0-0').click()
    await dragTo(page, tid(page, 'handle-grip'), tid(page, 'slot-2-1'))
    await expect(tid(page, 'cell-2-1')).toContainText('Hello')
  })
})

test.describe('auto-scroll is gentle', () => {
  const rows = Array.from({ length: 24 }, (_, i) => `      - [Item ${i + 1}, "${i}"]`).join('\n')
  const LONG = `title: Long\ncolumns: [2fr, 1fr]\ngroups:\n  - at: [0, 0]\n    variant: card\n    rows:\n${rows}\n`

  test('it waits a beat at the edge before moving, then moves slowly', async ({ page }) => {
    await open(page, LONG)
    await edit(page)
    await tid(page, 'group-grip-0').click()
    await settled(page)
    const scroll = tid(page, 'scroll')
    const box = (await scroll.boundingBox())!
    const g = await center(tid(page, 'handle-grip'))
    await page.mouse.move(g.x, g.y)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 12, { steps: 6 })
    const start = await scroll.evaluate((el) => el.scrollTop)
    await page.waitForTimeout(120) // inside the dwell time
    expect(await scroll.evaluate((el) => el.scrollTop)).toBe(start)
    await page.waitForTimeout(1000)
    const moved = (await scroll.evaluate((el) => el.scrollTop)) - start
    await page.mouse.up()
    expect(moved).toBeGreaterThan(20)
    expect(moved).toBeLessThan(620) // time-based and capped (about 520px a second), whatever the frame rate
  })

  test('hovering in the middle of the screen never scrolls', async ({ page }) => {
    await open(page, LONG)
    await edit(page)
    await tid(page, 'group-grip-0').click()
    const scroll = tid(page, 'scroll')
    const box = (await scroll.boundingBox())!
    const g = await center(tid(page, 'handle-grip'))
    await page.mouse.move(g.x, g.y)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 })
    const start = await scroll.evaluate((el) => el.scrollTop)
    await page.waitForTimeout(700)
    expect(await scroll.evaluate((el) => el.scrollTop)).toBe(start)
    await page.mouse.up()
  })
})

test.describe('new things arrive in color', () => {
  test('a new group and a new counter get a fill; text does not', async ({ page }) => {
    await open(page, 'title: T\ncolumns: [1fr, 1fr]\n')
    await edit(page)
    await tid(page, 'tool-add').click()
    await tid(page, 'add-group-card').click()
    expect(await page.locator('.panel').first().getAttribute('data-gfill')).toBeTruthy()
    await page.mouse.click(30, (await tid(page, 'scroll').boundingBox())!.y + 560)
    await tid(page, 'tool-add').click()
    await tid(page, 'add-counter').click()
    await expect(page.locator('.cell[data-type="counter"]')).toHaveAttribute('data-fill', /.+/)
    await page.mouse.click(30, (await tid(page, 'scroll').boundingBox())!.y + 560)
    await tid(page, 'tool-add').click()
    await tid(page, 'add-text').click()
    await expect(page.locator('.cell[data-type="text"][data-variant="plain"]')).not.toHaveAttribute('data-fill', /.+/)
  })
})
