import { STARTER, center, dragTo, edit, expect, open, settled, test, tid } from './fixtures'

// iPad landscape / desktop: an inspector beside the note instead of a dock and sheets.

test.describe('large-screen layout', () => {
  test('viewing is the same: no inspector, no dock', async ({ page }) => {
    await open(page, STARTER)
    await expect(tid(page, 'inspector')).toHaveCount(0)
    await expect(tid(page, 'dock')).toHaveCount(0)
    await expect(page.locator('.app')).toHaveAttribute('data-wide', 'true')
  })

  test('editing opens the inspector instead of a dock; undo and redo move to the header', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await expect(tid(page, 'inspector')).toBeVisible()
    await expect(tid(page, 'dock')).toHaveCount(0)
    const header = (await page.locator('.topbar').boundingBox())!
    for (const id of ['undo', 'redo']) {
      const b = (await tid(page, id).boundingBox())!
      expect(b.y).toBeLessThan(header.y + header.height)
    }
    await edit(page)
    await expect(tid(page, 'inspector')).toHaveCount(0)
  })

  test('the inspector sits beside the note without covering it', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    const insp = (await tid(page, 'inspector').boundingBox())!
    const scroll = (await tid(page, 'scroll').boundingBox())!
    expect(scroll.x + scroll.width).toBeLessThanOrEqual(insp.x + 1)
    const vp = page.viewportSize()!
    expect(insp.x + insp.width).toBeLessThanOrEqual(vp.width)
  })

  test('cells stay a comfortable size, and the header lines up with the left edge', async ({ page }) => {
    await open(page, STARTER)
    await settled(page)
    const row = (await tid(page, 'cell-1-1').boundingBox())!
    expect(row.height).toBeLessThanOrEqual(192)
    const title = (await tid(page, 'title').boundingBox())!
    const pane = (await tid(page, 'scroll').boundingBox())!
    expect(title.x - pane.x).toBeLessThan(80)
  })

  test('wide counters and timers lay out sideways and keep their captions', async ({ page }) => {
    await open(page, STARTER)
    await settled(page)
    for (const id of ['cell-1-1', 'cell-2-1']) {
      const buttons = (await tid(page, id).locator('.buttons').boundingBox())!
      const value = (await tid(page, id).locator('.value').boundingBox())!
      expect(buttons.x).toBeGreaterThan(value.x + value.width - 1)
    }
  })
})

test.describe('the inspector follows the selection', () => {
  test('nothing selected: add things and choose the layout', async ({ page }) => {
    await open(page, 'title: T\ncolumns: [1fr, 1fr]\n')
    await edit(page)
    await expect(tid(page, 'insp-what')).toHaveText('Note')
    await expect(tid(page, 'add-heading')).toBeVisible()
    await expect(tid(page, 'add-group-stripe')).toBeVisible()
    await expect(tid(page, 'flow-down')).toBeVisible()
    await tid(page, 'add-counter').click()
    await expect(tid(page, 'cell-0-0').getByTestId('counter-value')).toBeVisible()
    await expect(tid(page, 'insp-what')).toHaveText('Cell · Counter') // it selected what it added
  })

  test('a cell: fill, style and widget settings are all there, with no popups', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'cell-1-1').click()
    await expect(tid(page, 'insp-what')).toHaveText('Cell · Counter')
    await expect(tid(page, 'tool-add-row')).toBeVisible()
    await tid(page, 'fill-red').click()
    await expect(tid(page, 'cell-1-1')).toHaveAttribute('data-fill', 'red')
    await tid(page, 'style-bold').click()
    await expect(tid(page, 'cell-1-1')).toHaveCSS('font-weight', '700')
    await tid(page, 'font-display').click()
    await expect(tid(page, 'cell-1-1')).toHaveAttribute('data-font', 'display')
    await tid(page, 'setting-label').fill('Reps')
    await expect(tid(page, 'cell-1-1').getByTestId('label')).toHaveText('Reps')
    await tid(page, 'type-timer').click()
    await expect(tid(page, 'cell-1-1').getByTestId('timer-value')).toBeVisible()
    await expect(page.locator('.popover')).toHaveCount(0)
  })

  test('a group: look and tint, plus duplicate, ungroup and delete', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'group-grip-0').click()
    await expect(tid(page, 'insp-what')).toContainText('Group')
    await tid(page, 'look-card').click()
    await expect(tid(page, 'cell-0-1')).toHaveAttribute('data-variant', 'card')
    await tid(page, 'group-fill-green').click()
    await expect(page.locator('.panel')).toHaveAttribute('data-gfill', 'green')
    await tid(page, 'tool-duplicate').click()
    await expect(tid(page, 'cell-0-3')).toBeVisible()
    await tid(page, 'tool-delete').click()
    await expect(tid(page, 'cell-0-3')).toHaveCount(0)
    await expect(tid(page, 'insp-what')).toHaveText('Note') // the selection went with it
  })

  test('switching the scroll direction from the inspector', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'flow-right').click()
    await expect(page.locator('.app')).toHaveAttribute('data-flow', 'right')
    await tid(page, 'flow-down').click()
    await expect(page.locator('.app')).toHaveAttribute('data-flow', 'down')
  })

  test('the inspector scrolls on its own and never moves the note', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'cell-0-1').click()
    const body = tid(page, 'inspector').locator('.insp-body')
    expect(await body.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)
    const before = (await tid(page, 'cell-0-1').boundingBox())!
    await body.evaluate((el) => el.scrollTo(0, el.scrollHeight))
    await expect(tid(page, 'icon-fork')).toBeVisible()
    expect(await tid(page, 'cell-0-1').boundingBox()).toEqual(before)
  })
})

test.describe('editing still works with a mouse', () => {
  test('selection, drag-to-duplicate and the column menu', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'group-grip-0').click()
    await settled(page)
    await dragTo(page, tid(page, 'handle-bottom'), tid(page, 'slot-0-3'))
    await expect(tid(page, 'cell-0-3')).toBeVisible()
    await tid(page, 'col-tab-1').click()
    await expect(tid(page, 'pop-column')).toBeVisible()
    await tid(page, 'col-w3').click()
    await expect(tid(page, 'col-tab-1')).toHaveText('3x')
  })

  test('keyboard: arrows move the selection, Escape clears it, undo works', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'cell-0-0').click()
    await page.keyboard.press('ArrowDown')
    await expect(tid(page, 'cell-0-1')).toHaveAttribute('data-selected', 'true')
    await page.keyboard.press('Escape')
    await expect(tid(page, 'insp-what')).toHaveText('Note')
    await tid(page, 'title-input').fill('Changed')
    await page.keyboard.press('ControlOrMeta+z')
    await expect(tid(page, 'title-input')).toHaveValue('Leg day')
  })

  test('no hover effects on empty slots', async ({ page }) => {
    await open(page, 'title: H\ncolumns: [1fr, 1fr]\ncells:\n  - {at: [0, 0], text: Hi}\n')
    await edit(page)
    const slot = tid(page, 'slot-1-0')
    const style = () => slot.evaluate((el) => getComputedStyle(el).borderTopColor + getComputedStyle(el).backgroundColor)
    const before = await style()
    const c = await center(slot)
    await page.mouse.move(c.x, c.y)
    await page.waitForTimeout(200)
    expect(await style()).toBe(before)
  })
})

test.describe('large right-flow notes', () => {
  test('the cell size is capped, so a tall window does not blow cells up', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1300 })
    await open(page, 'title: R\nflow: right\ngroups:\n  - at: [0, 0]\n    variant: card\n    rows:\n      - [a, b, c, d, e, f]\n      - [a, b, c, d, e, f]\n')
    await settled(page)
    const cell = (await tid(page, 'cell-0-0').boundingBox())!
    expect(cell.height).toBeLessThanOrEqual(222)
    expect(Math.abs(cell.width - cell.height)).toBeLessThan(cell.height * 0.15)
  })
})

test.describe('settings on a big screen', () => {
  test('open from the sidebar, as a centered sheet', async ({ page }) => {
    await open(page, STARTER)
    await tid(page, 'settings-open').click()
    await settled(page)
    const box = (await tid(page, 'settings').boundingBox())!
    const vp = page.viewportSize()!
    expect(Math.abs(box.x + box.width / 2 - vp.width / 2)).toBeLessThan(2)
    expect(box.y).toBeGreaterThan(0)
    expect(box.y + box.height).toBeLessThan(vp.height)
    await page.keyboard.press('Escape')
    await expect(tid(page, 'settings')).toHaveCount(0)
  })
})
