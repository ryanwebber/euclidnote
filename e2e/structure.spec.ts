import { STARTER, center, dragTo, edit, expect, open, settled, test, tid } from './fixtures'

const LOOSE = `title: Loose
columns: [1fr, 1fr, 1fr]
cells:
  - {at: [0, 0], text: Hello}
`
const EMPTY = 'title: T\ncolumns: [1fr, 1fr]\n'

test.describe('column ruler', () => {
  test('shows a tab per column with its relative width', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await expect(tid(page, 'col-tab-0')).toHaveText('2x')
    await expect(tid(page, 'col-tab-1')).toHaveText('1x')
    await expect(tid(page, 'col-tab-2')).toHaveText('1x')
    await expect(page.locator('[data-testid^="col-tab-"]')).toHaveCount(3)
  })

  test('the ruler is only there while editing', async ({ page }) => {
    await open(page, STARTER)
    await expect(tid(page, 'ruler')).toHaveCount(0)
    await edit(page)
    await expect(tid(page, 'ruler')).toBeVisible()
  })

  test('tapping a tab opens a menu hanging below it; widths can be preset', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await settled(page)
    const before = (await tid(page, 'cell-1-1').boundingBox())!.width
    await tid(page, 'col-tab-1').click()
    await expect(tid(page, 'pop-column')).toBeVisible()
    const tab = (await tid(page, 'col-tab-1').boundingBox())!
    const menu = (await tid(page, 'pop-column').boundingBox())!
    expect(menu.y).toBeGreaterThanOrEqual(tab.y + tab.height - 1)
    await tid(page, 'col-w3').click()
    await expect(tid(page, 'pop-column')).toHaveCount(0)
    await expect(tid(page, 'col-tab-1')).toHaveText('3x')
    expect((await tid(page, 'cell-1-1').boundingBox())!.width).toBeGreaterThan(before * 1.5)
    await tid(page, 'col-tab-1').click()
    await expect(tid(page, 'col-w3')).toHaveAttribute('aria-pressed', 'true')
    await tid(page, 'col-w1').click()
    await expect(tid(page, 'col-tab-1')).toHaveText('1x')
    await tid(page, 'col-tab-1').click()
    await tid(page, 'col-equal').click()
    for (const i of [0, 1, 2]) await expect(tid(page, `col-tab-${i}`)).toHaveText('1x')
  })

  test('insert left and right add a column next to this one', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'col-tab-1').click()
    await tid(page, 'col-insert-right').click()
    await expect(page.locator('[data-testid^="col-tab-"]')).toHaveCount(4)
    // The group grew a column shaped like the one beside it (a blank counter); the timer moved right.
    await expect(tid(page, 'cell-3-1').getByTestId('timer-value')).toBeVisible()
    await expect(tid(page, 'cell-2-1').getByTestId('counter-value')).toHaveText('0')
    await tid(page, 'col-tab-0').click()
    await tid(page, 'col-insert-left').click()
    await expect(page.locator('[data-testid^="col-tab-"]')).toHaveCount(5)
    await expect(tid(page, 'cell-1-1')).toContainText('Squat')
  })

  test('a down note stops at 5 columns', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'col-add').click()
    await tid(page, 'col-add').click()
    await expect(page.locator('[data-testid^="col-tab-"]')).toHaveCount(5)
    await expect(tid(page, 'col-add')).toHaveCount(0)
    await tid(page, 'col-tab-2').click()
    await expect(tid(page, 'col-insert-left')).toBeDisabled()
    await expect(tid(page, 'col-insert-right')).toBeDisabled()
    await expect(tid(page, 'col-delete')).toBeEnabled()
  })

  test('the + button adds a column at the end', async ({ page }) => {
    await open(page, LOOSE)
    await edit(page)
    await tid(page, 'col-add').click()
    await expect(page.locator('[data-testid^="col-tab-"]')).toHaveCount(4)
    await tid(page, 'undo').click()
    await expect(page.locator('[data-testid^="col-tab-"]')).toHaveCount(3)
  })

  test('deleting a column removes what is in it and closes the gap', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'col-tab-1').click()
    await tid(page, 'col-delete').click()
    await expect(page.locator('[data-testid^="col-tab-"]')).toHaveCount(2)
    await expect(tid(page, 'cell-1-1').getByTestId('timer-value')).toBeVisible() // the timer moved left
    await expect(tid(page, 'cell-2-1')).toHaveCount(0)
    await tid(page, 'undo').click()
    await expect(page.locator('[data-testid^="col-tab-"]')).toHaveCount(3)
  })

  test('the last column cannot be deleted', async ({ page }) => {
    await open(page, 'title: T\ncolumns: [1fr]\n')
    await edit(page)
    await tid(page, 'col-tab-0').click()
    await expect(tid(page, 'col-delete')).toBeDisabled()
  })

  test('the menu closes on an outside tap and on Escape (which keeps the selection)', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'cell-0-1').click()
    await tid(page, 'col-tab-0').click()
    await expect(tid(page, 'pop-column')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(tid(page, 'pop-column')).toHaveCount(0)
    await expect(tid(page, 'cell-0-1')).toHaveAttribute('data-selected', 'true')
    await tid(page, 'col-tab-0').click()
    await page.mouse.click(40, (await tid(page, 'scroll').boundingBox())!.y + 500)
    await expect(tid(page, 'pop-column')).toHaveCount(0)
  })

  test('in a right note every column gets a tab and there is no cap', async ({ page }) => {
    const cols = Array.from({ length: 7 }, (_, i) => `D${i}`).join(', ')
    await open(page, `title: T\nflow: right\ngroups:\n  - at: [0, 0]\n    rows:\n      - [${cols}]\n      - [${cols}]\n`)
    await edit(page)
    await expect(page.locator('[data-testid^="col-tab-"]')).toHaveCount(7)
    await tid(page, 'col-add').click()
    await expect(page.locator('[data-testid^="col-tab-"]')).toHaveCount(8)
  })
})

test.describe('dragging across empty slots makes a group', () => {
  test('sweeping out an area creates a group there and offers its look', async ({ page }) => {
    await open(page, LOOSE)
    await edit(page)
    await dragTo(page, tid(page, 'slot-1-0'), tid(page, 'slot-2-1'))
    for (const c of ['cell-1-0', 'cell-2-0', 'cell-1-1', 'cell-2-1']) await expect(tid(page, c)).toBeVisible()
    await expect(tid(page, 'cell-1-0')).toHaveText('')
    await expect(tid(page, 'selection')).toHaveAttribute('data-kind', 'group')
    await expect(tid(page, 'pop-look')).toBeVisible()
    await tid(page, 'look-table').click()
    await expect(tid(page, 'cell-1-0')).toHaveAttribute('data-variant', 'table')
  })

  test('the ghost previews the area while sweeping', async ({ page }) => {
    await open(page, LOOSE)
    await edit(page)
    const a = await center(tid(page, 'slot-1-0'))
    const b = await center(tid(page, 'slot-2-1'))
    await page.mouse.move(a.x, a.y)
    await page.mouse.down()
    await page.mouse.move(b.x, b.y, { steps: 8 })
    await expect(tid(page, 'ghost')).toHaveAttribute('data-valid', 'true')
    const g = (await page.locator('.ghosted').first().boundingBox())!
    expect(g.width).toBeGreaterThan((await tid(page, 'slot-1-0').boundingBox())!.width * 1.8)
    await page.mouse.up()
  })

  test('sweeping over something that is already there is refused', async ({ page }) => {
    await open(page, LOOSE)
    await edit(page)
    const a = await center(tid(page, 'slot-1-0'))
    const b = await center(tid(page, 'cell-0-0'))
    await page.mouse.move(a.x, a.y)
    await page.mouse.down()
    await page.mouse.move(b.x, b.y, { steps: 8 })
    await expect(tid(page, 'ghost')).toHaveAttribute('data-valid', 'false')
    await page.mouse.up()
    await expect(tid(page, 'pop-look')).toHaveCount(0)
    await expect(tid(page, 'selection')).toHaveCount(0)
  })

  test('a plain tap on a slot still adds a single cell', async ({ page }) => {
    await open(page, LOOSE)
    await edit(page)
    await tid(page, 'slot-1-0').click()
    await expect(tid(page, 'cell-1-0').getByTestId('text-editor')).toBeFocused()
  })

  test('the sweep is one undo step', async ({ page }) => {
    await open(page, LOOSE)
    await edit(page)
    await dragTo(page, tid(page, 'slot-1-0'), tid(page, 'slot-2-1'))
    await tid(page, 'pop-close').click()
    await tid(page, 'undo').click()
    await expect(tid(page, 'cell-2-1')).toHaveCount(0)
    await expect(tid(page, 'slot-2-1')).toBeVisible()
  })
})

test.describe('duplicating', () => {
  test('a group is copied next to itself and the copy is selected', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'group-grip-0').click()
    await tid(page, 'tool-duplicate').click()
    await expect(tid(page, 'cell-0-3')).toBeVisible()
    await expect(tid(page, 'cell-0-3')).toHaveText('')
    await expect(tid(page, 'cell-1-3').getByTestId('counter-value')).toHaveText('0')
    await expect(tid(page, 'selection')).toHaveAttribute('data-kind', 'group')
    await tid(page, 'tool-duplicate').click() // and again, from the copy
    await expect(tid(page, 'cell-0-5')).toBeVisible()
    await tid(page, 'undo').click()
    await expect(tid(page, 'cell-0-5')).toHaveCount(0)
  })

  test('a loose cell is copied blank, keeping its look, right below it; the group makes room', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'cell-0-0').click()
    await tid(page, 'tool-duplicate').click()
    await expect(tid(page, 'cell-0-1')).toHaveText('')
    await expect(tid(page, 'cell-0-1')).toHaveCSS('font-weight', '700')
    await expect(tid(page, 'cell-0-2')).toContainText('Squat') // pushed down one row
  })

  test('Add row inside a group repeats that row, shaped like it', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'cell-0-1').click()
    await tid(page, 'tool-add-row').click()
    await expect(tid(page, 'cell-0-2')).toHaveText('') // the new row
    await expect(tid(page, 'cell-1-2').getByTestId('counter-value')).toHaveText('0')
    await expect(tid(page, 'cell-0-3')).toContainText('Lunge') // the old second row moved down
    await expect(tid(page, 'cell-0-2')).toHaveAttribute('data-selected', 'true')
  })

  test('there is no Delete for a grouped cell, but Add row is offered', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'cell-0-1').click()
    await expect(tid(page, 'tool-delete')).toHaveCount(0)
    await expect(tid(page, 'tool-add-row')).toBeVisible()
  })
})

test.describe('add sheet', () => {
  test('lists cells, trackers and groups', async ({ page }) => {
    await open(page, EMPTY)
    await edit(page)
    await tid(page, 'tool-add').click()
    await expect(tid(page, 'pop-add')).toBeVisible()
    for (const id of ['heading', 'text', 'check', 'toggle', 'number', 'tag', 'counter', 'timer', 'rating', 'mood', 'progress', 'habit', 'date', 'countdown']) {
      await expect(tid(page, `add-${id}`)).toBeVisible()
    }
    for (const v of ['plain', 'card', 'table', 'header', 'sidebar', 'stripe', 'stack', 'tiles', 'outline']) {
      await expect(tid(page, `add-group-${v}`)).toBeVisible()
    }
  })

  for (const [id, probe] of [
    ['check', 'check-box'], ['toggle', 'toggle-switch'], ['counter', 'counter-value'], ['number', 'number-input'],
    ['timer', 'timer-value'], ['rating', 'star-1'], ['mood', 'mood-1'], ['progress', 'progress-value'], ['habit', 'day-1'],
    ['tag', 'tag'], ['date', 'date-value'], ['countdown', 'countdown-caption'],
  ] as const) {
    test(`adding a ${id} puts it in the first free cell and selects it`, async ({ page }) => {
      await open(page, EMPTY)
      await edit(page)
      await tid(page, 'tool-add').click()
      await tid(page, `add-${id}`).click()
      await expect(tid(page, 'cell-0-0').getByTestId(probe)).toBeVisible()
      await expect(tid(page, 'cell-0-0')).toHaveAttribute('data-selected', 'true')
      await expect(tid(page, 'pop-add')).toHaveCount(0)
    })
  }

  test('a heading is wide, big and bold, ready to type', async ({ page }) => {
    await open(page, EMPTY)
    await edit(page)
    await tid(page, 'tool-add').click()
    await tid(page, 'add-heading').click()
    const cell = tid(page, 'cell-0-0')
    await expect(cell).toHaveAttribute('data-size', 'title')
    await expect(tid(page, 'text-editor')).toBeFocused()
    await page.keyboard.type('Plan')
    await page.keyboard.press('Escape')
    await expect(cell).toContainText('Plan')
    expect((await cell.boundingBox())!.width).toBeGreaterThan(300)
  })

  for (const look of ['plain', 'card', 'table', 'header', 'sidebar', 'stripe', 'stack', 'tiles', 'outline']) {
    test(`a ${look} group lands selected with that look`, async ({ page }) => {
      await open(page, EMPTY)
      await edit(page)
      await tid(page, 'tool-add').click()
      await tid(page, `add-group-${look}`).click()
      await expect(tid(page, 'cell-0-0')).toHaveAttribute('data-variant', look)
      await expect(tid(page, 'selection')).toHaveAttribute('data-kind', 'group')
    })
  }
})

test.describe('popovers', () => {
  test('close on outside tap, Escape (keeping the selection) and the close button', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'cell-0-1').click()
    await tid(page, 'tool-format').click()
    await expect(tid(page, 'pop-format')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(tid(page, 'pop-format')).toHaveCount(0)
    await expect(tid(page, 'cell-0-1')).toHaveAttribute('data-selected', 'true')
    await tid(page, 'tool-format').click()
    await tid(page, 'pop-close').click()
    await expect(tid(page, 'pop-format')).toHaveCount(0)
    await tid(page, 'tool-fill').click()
    await expect(tid(page, 'pop-fill')).toBeVisible()
    await tid(page, 'tool-fill').click() // toggles closed
    await expect(tid(page, 'pop-fill')).toHaveCount(0)
    await tid(page, 'tool-widget').click()
    await tid(page, 'cell-1-1').dispatchEvent('click') // the tall sheet covers it; selecting something else closes it
    await expect(tid(page, 'pop-widget')).toHaveCount(0)
  })

  test('only one is open at a time, and they stay on screen above the dock', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'cell-0-1').click()
    await tid(page, 'tool-widget').click()
    await tid(page, 'tool-format').click()
    await expect(tid(page, 'pop-widget')).toHaveCount(0)
    const pop = (await tid(page, 'pop-format').boundingBox())!
    const dock = (await tid(page, 'dock').boundingBox())!
    const vp = page.viewportSize()!
    expect(pop.x).toBeGreaterThanOrEqual(0)
    expect(pop.x + pop.width).toBeLessThanOrEqual(vp.width)
    expect(pop.y + pop.height).toBeLessThanOrEqual(dock.y)
    expect(pop.y).toBeGreaterThanOrEqual(0)
  })

  test('tall sheets scroll inside themselves', async ({ page }) => {
    await open(page, LOOSE)
    await edit(page)
    await tid(page, 'cell-0-0').click()
    await tid(page, 'tool-format').click()
    const body = tid(page, 'pop-format').locator('.sheet-body')
    expect(await body.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)
    await body.evaluate((el) => el.scrollTo(0, el.scrollHeight))
    await expect(tid(page, 'icon-fork')).toBeVisible()
  })
})

test.describe('layout sheet', () => {
  test('switches the scroll direction and explains when it cannot', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'tool-layout').click()
    await expect(tid(page, 'flow-down')).toHaveAttribute('aria-pressed', 'true')
    await tid(page, 'flow-right').click()
    await expect(page.locator('.app')).toHaveAttribute('data-flow', 'right')
    await tid(page, 'flow-down').click()
    await expect(page.locator('.app')).toHaveAttribute('data-flow', 'down')
  })

  test('explains when a switch is not possible', async ({ page }) => {
    const tall = Array.from({ length: 7 }, (_, i) => `      - [r${i}]`).join('\n')
    await open(page, `title: T\ngroups:\n  - at: [0, 0]\n    rows:\n${tall}\n`)
    await edit(page)
    await tid(page, 'tool-layout').click()
    await expect(tid(page, 'flow-right')).toBeDisabled()
    await expect(tid(page, 'flow-hint')).toContainText('at most 5 rows')
  })

  test('switching flow never moves a cell', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'tool-layout').click()
    await tid(page, 'flow-right').click()
    for (const [x, y] of [[0, 0], [0, 1], [1, 1], [2, 1], [0, 2]]) await expect(tid(page, `cell-${x}-${y}`)).toBeVisible()
    await expect(tid(page, 'cell-0-1')).toContainText('Squat')
  })
})
