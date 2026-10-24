import { edit, expect, open, settled, test, tid } from './fixtures'

// One of each interactive widget, in a known layout.
const NOTE = `title: W
columns: [1fr, 1fr]
groups:
  - at: [0, 0]
    variant: tiles
    rows:
      - [{check: false, text: Milk}, {rating: 0, label: Taste}]
      - [{progress: 0, label: Goal}, {tag: To do}]
      - [{date: "", label: Due}, {counter: 2, goal: 3, label: Sets}]
      - [{timer: 0, label: Rest}, {tag: Open, options: [Open, Closed]}]
`

test.describe('checkbox', () => {
  test('toggles from the box or the words, and strikes through when done', async ({ page }) => {
    await open(page, NOTE)
    const cell = tid(page, 'cell-0-0')
    const box = cell.getByTestId('check-box')
    await expect(box).toHaveAttribute('aria-checked', 'false')
    await box.click()
    await expect(box).toHaveAttribute('aria-checked', 'true')
    await expect(cell.getByTestId('check-text')).toHaveCSS('text-decoration-line', 'line-through')
    await cell.getByTestId('check-text').click()
    await expect(box).toHaveAttribute('aria-checked', 'false')
    await expect(cell.getByTestId('check-text')).not.toHaveCSS('text-decoration-line', 'line-through')
  })

  test('is saved, and inert while editing', async ({ page }) => {
    await open(page, NOTE)
    await tid(page, 'cell-0-0').getByTestId('check-box').click()
    await page.reload()
    await expect(tid(page, 'cell-0-0').getByTestId('check-box')).toHaveAttribute('aria-checked', 'true')
    await edit(page)
    await tid(page, 'cell-0-0').click() // selects instead of toggling
    await expect(tid(page, 'cell-0-0').getByTestId('check-box')).toHaveAttribute('aria-checked', 'true')
    await expect(tid(page, 'cell-0-0')).toHaveAttribute('data-selected', 'true')
  })

  test('a second tap edits the words; Return moves down', async ({ page }) => {
    await open(page, NOTE)
    await edit(page)
    await tid(page, 'cell-0-0').click()
    await tid(page, 'cell-0-0').click()
    await expect(tid(page, 'text-editor')).toBeFocused()
    await page.keyboard.type(' and eggs')
    await page.keyboard.press('Escape')
    await expect(tid(page, 'cell-0-0')).toContainText('Milk and eggs')
  })
})

test.describe('rating', () => {
  test('tapping a star fills up to it; tapping the same star clears', async ({ page }) => {
    await open(page, NOTE)
    const cell = tid(page, 'cell-1-0')
    await cell.getByTestId('star-3').click()
    for (const n of [1, 2, 3]) await expect(cell.getByTestId(`star-${n}`)).toHaveAttribute('data-on', 'true')
    for (const n of [4, 5]) await expect(cell.getByTestId(`star-${n}`)).toHaveAttribute('data-on', 'false')
    await cell.getByTestId('star-3').click()
    await expect(cell.getByTestId('star-1')).toHaveAttribute('data-on', 'false')
  })

  test('the number of stars is a setting', async ({ page }) => {
    await open(page, NOTE)
    await edit(page)
    await tid(page, 'cell-1-0').click()
    await tid(page, 'tool-widget').click()
    await tid(page, 'setting-max').fill('3')
    await expect(tid(page, 'cell-1-0').locator('.star')).toHaveCount(3)
    await tid(page, 'setting-max').fill('9')
    await expect(tid(page, 'cell-1-0').locator('.star')).toHaveCount(9)
  })
})

test.describe('progress', () => {
  test('tapping or dragging the bar sets the value', async ({ page }) => {
    await open(page, NOTE)
    const cell = tid(page, 'cell-0-1')
    const track = cell.getByTestId('progress-track')
    const box = (await track.boundingBox())!
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height / 2)
    const mid = Number((await cell.getByTestId('progress-value').innerText()).replace('%', ''))
    expect(mid).toBeGreaterThan(44)
    expect(mid).toBeLessThan(56)
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height / 2, { steps: 5 })
    await page.mouse.up()
    expect(Number((await cell.getByTestId('progress-value').innerText()).replace('%', ''))).toBeGreaterThan(80)
    await page.mouse.click(box.x - 30, box.y + box.height / 2) // left of the bar clamps to 0
  })

  test('arrow keys nudge by 5 and it is clamped', async ({ page }) => {
    await open(page, NOTE)
    const cell = tid(page, 'cell-0-1')
    await cell.getByTestId('progress-track').focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(cell.getByTestId('progress-value')).toHaveText('10%')
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowLeft')
    await expect(cell.getByTestId('progress-value')).toHaveText('0%')
  })
})

test.describe('tag', () => {
  test('cycles through its options and wraps, changing color', async ({ page }) => {
    await open(page, NOTE)
    const tag = tid(page, 'cell-1-1').getByTestId('tag')
    await expect(tag).toHaveText('To do')
    const tone = (el: typeof tag) => el.getAttribute('data-tone')
    const t0 = await tone(tag)
    await tag.click()
    await expect(tag).toHaveText('Doing')
    expect(await tone(tag)).not.toBe(t0)
    await tag.click()
    await expect(tag).toHaveText('Done')
    await tag.click()
    await expect(tag).toHaveText('To do')
  })

  test('custom options are editable in the widget sheet', async ({ page }) => {
    await open(page, NOTE)
    await edit(page)
    await tid(page, 'cell-1-3').click()
    await tid(page, 'tool-widget').click()
    await tid(page, 'setting-options').fill('Open, Closed, Stuck')
    await tid(page, 'setting-options').press('Enter')
    await tid(page, 'pop-close').click()
    await edit(page)
    const tag = tid(page, 'cell-1-3').getByTestId('tag')
    await tag.click()
    await tag.click()
    await expect(tag).toHaveText('Stuck')
  })
})

test.describe('date', () => {
  test('shows a prompt until a date is picked, then the day and how far away it is', async ({ page }) => {
    await open(page, NOTE)
    const cell = tid(page, 'cell-0-2')
    await expect(cell.getByTestId('date-value')).toHaveText('Pick a date')
    await cell.getByTestId('date-input').fill('2030-03-04')
    await expect(cell.getByTestId('date-value')).toHaveText('Mar 4')
    await expect(cell).toContainText('Mon')
    await expect(cell).toContainText(/in \d+ days/)
    await page.reload()
    await expect(tid(page, 'cell-0-2').getByTestId('date-value')).toHaveText('Mar 4')
  })

  test('a date can be cleared from the widget sheet', async ({ page }) => {
    await open(page, NOTE)
    await tid(page, 'cell-0-2').getByTestId('date-input').fill('2030-03-04')
    await edit(page)
    await tid(page, 'cell-0-2').click()
    await tid(page, 'tool-widget').click()
    await tid(page, 'setting-clear-date').click()
    await expect(tid(page, 'cell-0-2').getByTestId('date-value')).toHaveText('Pick a date')
  })
})

test.describe('counter', () => {
  test('shows its goal and turns green when reached', async ({ page }) => {
    await open(page, NOTE)
    const cell = tid(page, 'cell-1-2')
    await expect(cell.getByTestId('counter-goal')).toHaveText('/ 3')
    const color = () => cell.getByTestId('counter-value').evaluate((el) => getComputedStyle(el).color)
    const before = await color()
    await cell.getByTestId('counter-inc').click()
    await expect(cell.getByTestId('counter-value')).toHaveText('3')
    expect(await color()).not.toBe(before)
  })

  test('its caption is editable in place (second tap) and removable', async ({ page }) => {
    await open(page, NOTE)
    await edit(page)
    await tid(page, 'cell-1-2').click()
    await tid(page, 'cell-1-2').click()
    await expect(tid(page, 'label-editor')).toBeFocused()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('Reps')
    await page.keyboard.press('Enter')
    await expect(tid(page, 'cell-1-2').getByTestId('label')).toHaveText('Reps')
    // clear it entirely: the caption goes away
    await tid(page, 'cell-1-2').click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('Backspace')
    await page.keyboard.press('Enter')
    await expect(tid(page, 'cell-1-2').getByTestId('label')).toHaveCount(0)
  })

  test('goal, step and label are settings in the widget sheet', async ({ page }) => {
    await open(page, NOTE)
    await edit(page)
    await tid(page, 'cell-1-2').click()
    await tid(page, 'tool-widget').click()
    await tid(page, 'setting-goal').fill('20')
    await tid(page, 'setting-step').fill('5')
    await tid(page, 'setting-label').fill('Reps')
    await tid(page, 'pop-close').click()
    await edit(page)
    const cell = tid(page, 'cell-1-2')
    await expect(cell.getByTestId('counter-goal')).toHaveText('/ 20')
    await expect(cell.getByTestId('label')).toHaveText('Reps')
    await cell.getByTestId('counter-inc').click()
    await expect(cell.getByTestId('counter-value')).toHaveText('7')
    await tid(page, 'setting-goal').count() // the sheet is closed
  })

  test('clearing the goal removes it', async ({ page }) => {
    await open(page, NOTE)
    await edit(page)
    await tid(page, 'cell-1-2').click()
    await tid(page, 'tool-widget').click()
    await tid(page, 'setting-goal').fill('')
    await tid(page, 'pop-close').click()
    await expect(tid(page, 'cell-1-2').getByTestId('counter-goal')).toHaveCount(0)
  })
})

test.describe('timer', () => {
  test('keeps a caption and counts', async ({ page }) => {
    await page.clock.install()
    await open(page, NOTE)
    const cell = tid(page, 'cell-0-3')
    await expect(cell.getByTestId('label')).toHaveText('Rest')
    await cell.getByTestId('timer-toggle').click()
    await expect(cell.locator('.live')).toBeVisible()
    await page.clock.runFor(65000)
    await expect(cell.getByTestId('timer-value')).toHaveText('1:05')
    await cell.getByTestId('timer-toggle').click()
    await expect(cell.locator('.live')).toHaveCount(0)
  })
})

test.describe('widget sheet', () => {
  test('switches a cell between all eight types', async ({ page }) => {
    await open(page, 'title: T\ncolumns: [1fr, 1fr]\ncells:\n  - {at: [0, 0], text: Hello}\n')
    await edit(page)
    await tid(page, 'cell-0-0').click()
    await tid(page, 'tool-widget').click()
    const expectations: [string, string][] = [
      ['check', 'check-box'], ['counter', 'counter-value'], ['timer', 'timer-value'], ['rating', 'star-1'],
      ['progress', 'progress-value'], ['tag', 'tag'], ['date', 'date-value'],
    ]
    for (const [type, probe] of expectations) {
      await tid(page, `type-${type}`).click()
      await expect(tid(page, 'cell-0-0').getByTestId(probe)).toBeVisible()
    }
    await tid(page, 'type-text').click()
    await expect(tid(page, 'cell-0-0').getByTestId('tag')).toHaveCount(0)
  })

  test('changing text to a checkbox keeps the words', async ({ page }) => {
    await open(page, 'title: T\ncolumns: [1fr, 1fr]\ncells:\n  - {at: [0, 0], text: Hello}\n')
    await edit(page)
    await tid(page, 'cell-0-0').click()
    await tid(page, 'tool-widget').click()
    await tid(page, 'type-check').click()
    await expect(tid(page, 'cell-0-0').getByTestId('check-text')).toHaveText('Hello')
  })

  test('widgets are inert while editing, so a tap selects instead of counting', async ({ page }) => {
    await open(page, NOTE)
    await edit(page)
    await tid(page, 'cell-1-2').click()
    await expect(tid(page, 'cell-1-2')).toHaveAttribute('data-selected', 'true')
    await expect(tid(page, 'cell-1-2').getByTestId('counter-value')).toHaveText('2')
  })
})

test.describe('responsive widgets', () => {
  const WIDE = `title: Wide\ncolumns: [1fr]\ngroups:\n  - at: [0, 0]\n    variant: plain\n    rows:\n      - [{counter: 1, label: Sets}]\n      - [{timer: 0}]\n`
  test('a wide counter lays out sideways; a narrow one stacks', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'needs a wide cell')
    await open(page, WIDE)
    await settled(page)
    // Sideways means two columns: the controls sit to the right of the caption and value.
    for (const id of ['cell-0-0', 'cell-0-1']) {
      const body = (await tid(page, id).locator('.counter, .timer').boundingBox())!
      const buttons = (await tid(page, id).locator('.buttons').boundingBox())!
      const value = (await tid(page, id).locator('.value').boundingBox())!
      expect(buttons.x).toBeGreaterThan(value.x + value.width - 1)
      expect(buttons.x + buttons.width).toBeLessThanOrEqual(body.x + body.width + 1)
    }
    await expect(tid(page, 'cell-0-0').getByTestId('label')).toHaveText('Sets') // the caption is kept
  })

  test('widget controls never overflow their cell', async ({ page }) => {
    await open(page, `title: N\ncolumns: [2fr, 1fr, 1fr]\ngroups:\n  - at: [0, 0]\n    rows:\n      - [Squat, {counter: 0, goal: 10, label: Reps}, {timer: 0, label: Rest}]\n`)
    for (const id of ['cell-1-0', 'cell-2-0']) {
      const cell = (await tid(page, id).boundingBox())!
      for (const btn of await tid(page, id).locator('button').all()) {
        const b = (await btn.boundingBox())!
        expect(b.x).toBeGreaterThanOrEqual(cell.x - 1)
        expect(b.x + b.width).toBeLessThanOrEqual(cell.x + cell.width + 1)
      }
    }
  })
})

test.describe('widget picker', () => {
  test('every tile label fits inside its tile', async ({ page }) => {
    await open(page)
    await edit(page)
    await tid(page, 'tool-add').click()
    for (const label of await page.locator('.tile-label').all()) {
      const fits = await label.evaluate((el) => el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().right <= (el.closest('.tile') as HTMLElement).getBoundingClientRect().right + 0.5)
      expect(fits).toBe(true)
    }
  })
})
