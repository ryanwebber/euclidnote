import { type Page, STARTER, center, dragTo, edit, expect, open, settled, test, tid } from './fixtures'

// A group in the middle of a 3-column note, so there is room on every side.
const MID = `title: Mid
columns: [1fr, 1fr, 1fr]
groups:
  - at: [1, 1]
    variant: plain
    rows:
      - [Hi]
`
const LOOSE = `title: Loose
columns: [1fr, 1fr, 1fr]
cells:
  - {at: [0, 0], text: Hello}
`

const selectGroup = async (page: Page, g = 0) => {
  await tid(page, `group-grip-${g}`).click()
  await expect(tid(page, 'selection')).toHaveAttribute('data-kind', 'group')
  await settled(page)
}

test.describe('duplicate by dragging an edge dot', () => {
  for (const [side, slot, cell] of [
    ['bottom', 'slot-1-2', 'cell-1-2'],
    ['top', 'slot-1-0', 'cell-1-0'],
    ['left', 'slot-0-1', 'cell-0-1'],
    ['right', 'slot-2-1', 'cell-2-1'],
  ] as const) {
    test(`${side}: the copy lands where it is released, with the content cleared`, async ({ page }) => {
      await open(page, MID)
      await edit(page)
      await selectGroup(page)
      await dragTo(page, tid(page, `handle-${side}`), tid(page, slot))
      await expect(tid(page, cell)).toBeVisible()
      await expect(tid(page, cell)).toHaveText('')
      await expect(tid(page, 'cell-1-1')).toContainText('Hi') // the original is untouched
      // the new copy is selected, so you can keep going
      await expect(tid(page, 'selection')).toHaveAttribute('data-kind', 'group')
    })
  }

  test('a copy can be dropped well away from the group, not just next to it', async ({ page }) => {
    const vp = page.viewportSize()!
    await page.setViewportSize({ width: vp.width, height: 1400 }) // keep the target out of the auto-scroll zone
    await open(page, STARTER)
    await edit(page)
    await selectGroup(page)
    await dragTo(page, tid(page, 'handle-bottom'), tid(page, 'slot-0-3'))
    await expect(tid(page, 'cell-0-3')).toBeVisible()
    await expect(tid(page, 'cell-1-3').getByTestId('counter-value')).toHaveText('0')
    await expect(tid(page, 'cell-2-4').getByTestId('timer-value')).toBeVisible()
  })

  test('a drop that cannot fit is previewed in red and ignored', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await selectGroup(page)
    const a = await center(tid(page, 'handle-right'))
    await page.mouse.move(a.x, a.y)
    await page.mouse.down()
    await page.mouse.move(a.x + 6, a.y, { steps: 4 }) // a copy to the right would need 6 columns
    await expect(tid(page, 'ghost')).toHaveAttribute('data-valid', 'false')
    await page.mouse.up()
    await expect(tid(page, 'ghost')).toHaveCount(0)
    await expect(tid(page, 'group-grip-0')).toHaveCount(0) // still just the one (selected) group
  })

  test('undo removes the copy in one step', async ({ page }) => {
    await open(page, MID)
    await edit(page)
    await selectGroup(page)
    await dragTo(page, tid(page, 'handle-bottom'), tid(page, 'slot-1-2'))
    await expect(tid(page, 'cell-1-2')).toBeVisible()
    await tid(page, 'undo').click()
    await expect(tid(page, 'cell-1-2')).toHaveCount(0)
  })
})

test.describe('resize by dragging the corner', () => {
  test('growing repeats the last row', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await selectGroup(page)
    await dragTo(page, tid(page, 'handle-corner'), tid(page, 'slot-2-3'))
    await expect(tid(page, 'cell-1-3').getByTestId('counter-value')).toHaveText('0')
    await expect(tid(page, 'cell-0-3')).toBeVisible()
  })

  test('shrinking drops cells from the end', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await selectGroup(page)
    await dragTo(page, tid(page, 'handle-corner'), tid(page, 'cell-1-1'))
    await expect(tid(page, 'cell-2-1')).toHaveCount(0)
    await expect(tid(page, 'cell-0-2')).toHaveCount(0)
    await expect(tid(page, 'cell-1-1')).toBeVisible()
  })

  test('growing into another item pushes it down to make room', async ({ page }) => {
    await open(page, `title: T\ncolumns: [1fr, 1fr]\ncells:\n  - {at: [0, 2], span: 2, text: Below}\ngroups:\n  - at: [0, 0]\n    rows:\n      - [a, b]\n`)
    await edit(page)
    await selectGroup(page)
    const a = await center(tid(page, 'handle-corner'))
    const b = await center(tid(page, 'cell-0-2'))
    await page.mouse.move(a.x, a.y)
    await page.mouse.down()
    await page.mouse.move(b.x, b.y, { steps: 8 })
    await expect(tid(page, 'ghost')).toHaveAttribute('data-valid', 'true')
    await page.mouse.up()
    // the group grew into rows 1 and 2; what was at row 2 now sits below it
    await expect(tid(page, 'cell-0-1')).toBeVisible()
    await expect(tid(page, 'cell-0-2')).toBeVisible()
    await expect(tid(page, 'cell-0-3')).toContainText('Below')
    await tid(page, 'undo').click()
    await expect(tid(page, 'cell-0-2')).toContainText('Below')
  })

  test('growing past the column cap is still refused (red preview, no change)', async ({ page }) => {
    await open(page, `title: T\ncolumns: [1fr, 1fr, 1fr, 1fr, 1fr]\ngroups:\n  - at: [0, 0]\n    rows:\n      - [a, b, c, d, e]\n`)
    await edit(page)
    await selectGroup(page)
    const a = await center(tid(page, 'handle-right'))
    await page.mouse.move(a.x, a.y)
    await page.mouse.down()
    await page.mouse.move(a.x + 200, a.y + 5, { steps: 8 })
    await expect(tid(page, 'ghost')).toHaveAttribute('data-valid', 'false')
    await page.mouse.up()
    await expect(page.locator('[data-testid^="cell-"]')).toHaveCount(5)
  })
})

test.describe('fill handle', () => {
  test('dragging a loose cell corner turns it into a group of blank copies', async ({ page }) => {
    await open(page, LOOSE)
    await edit(page)
    await tid(page, 'cell-0-0').click()
    await dragTo(page, tid(page, 'handle-fill'), tid(page, 'slot-1-1'))
    for (const c of ['cell-1-0', 'cell-0-1', 'cell-1-1']) await expect(tid(page, c)).toBeVisible()
    await expect(tid(page, 'cell-0-0')).toContainText('Hello')
    await expect(tid(page, 'cell-1-1')).toHaveText('')
    await expect(tid(page, 'selection')).toHaveAttribute('data-kind', 'group')
  })

  test('a grouped cell has no fill handle', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'cell-0-1').click()
    await expect(tid(page, 'handle-fill')).toHaveCount(0)
  })
})

test.describe('span handle', () => {
  test('dragging a loose cell edge makes it span columns', async ({ page }) => {
    await open(page, LOOSE)
    await edit(page)
    await tid(page, 'cell-0-0').click()
    await settled(page)
    const before = (await tid(page, 'cell-0-0').boundingBox())!.width
    await dragTo(page, tid(page, 'handle-span'), tid(page, 'slot-2-0'))
    await settled(page)
    const after = (await tid(page, 'cell-0-0').boundingBox())!.width
    expect(after).toBeGreaterThan(before * 2.5)
    await tid(page, 'undo').click()
    expect((await tid(page, 'cell-0-0').boundingBox())!.width).toBeCloseTo(before, 0)
  })

  test('in a group, widening a cell takes room from its neighbours', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'cell-0-1').click()
    const before = (await tid(page, 'cell-0-1').boundingBox())!.width
    await dragTo(page, tid(page, 'handle-span'), tid(page, 'cell-1-1'))
    await settled(page)
    // Squat now covers columns 0-1, so the counter that was at column 1 is gone; the timer stays.
    await expect(tid(page, 'cell-1-1')).toHaveCount(0)
    await expect(tid(page, 'cell-2-1').getByTestId('timer-value')).toBeVisible()
    expect((await tid(page, 'cell-0-1').boundingBox())!.width).toBeGreaterThan(before * 1.3)
  })
})

test.describe('moving', () => {
  test('dragging a group grip moves the group', async ({ page }) => {
    await open(page, MID)
    await edit(page)
    await dragTo(page, tid(page, 'group-grip-0'), tid(page, 'slot-0-2'))
    await expect(tid(page, 'cell-0-2')).toContainText('Hi')
    await expect(tid(page, 'cell-1-1')).toHaveCount(0)
    await expect(tid(page, 'selection')).toHaveAttribute('data-kind', 'group')
  })

  test('dragging a loose cell grip moves the cell', async ({ page }) => {
    await open(page, LOOSE)
    await edit(page)
    await tid(page, 'cell-0-0').click()
    await dragTo(page, tid(page, 'handle-grip'), tid(page, 'slot-2-1'))
    await expect(tid(page, 'cell-2-1')).toContainText('Hello')
    await expect(tid(page, 'cell-0-0')).toHaveCount(0)
    await tid(page, 'undo').click()
    await expect(tid(page, 'cell-0-0')).toContainText('Hello')
  })

  test('cannot be dropped on something else', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    const a = await center(tid(page, 'group-grip-0'))
    const b = await center(tid(page, 'cell-0-0'))
    await page.mouse.move(a.x, a.y)
    await page.mouse.down()
    await page.mouse.move(b.x, b.y, { steps: 8 })
    await expect(tid(page, 'ghost')).toHaveAttribute('data-valid', 'false')
    await page.mouse.up()
    await expect(tid(page, 'cell-0-1')).toContainText('Squat')
  })

  test('a tap on a grip (no drag) selects instead of moving', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'group-grip-0').click()
    await expect(tid(page, 'cell-0-1')).toContainText('Squat')
    await expect(tid(page, 'ghost')).toHaveCount(0)
    await expect(tid(page, 'undo')).toBeDisabled()
  })
})

test.describe('column widths', () => {
  test('dragging a separator moves half a grid square at a time', async ({ page }) => {
    await open(page, STARTER) // [2fr, 1fr, 1fr]
    await edit(page)
    await settled(page)
    const w = async (id: string) => (await tid(page, id).boundingBox())!.width
    const [a0, b0, c0] = [await w('cell-0-1'), await w('cell-1-1'), await w('cell-2-1')]
    const square = b0 // one unit
    const sep = await center(tid(page, 'sep-0'))
    await page.mouse.move(sep.x, sep.y)
    await page.mouse.down()
    await page.mouse.move(sep.x - square * 0.15, sep.y, { steps: 3 }) // less than a quarter square: nothing changes
    expect(await w('cell-0-1')).toBeCloseTo(a0, 0)
    await page.mouse.move(sep.x - square * 0.55, sep.y, { steps: 4 }) // past a quarter: one half step
    await page.mouse.up()
    await settled(page)
    const [a1, b1, c1] = [await w('cell-0-1'), await w('cell-1-1'), await w('cell-2-1')]
    expect(a1).toBeLessThan(a0 - square * 0.35)
    expect(a1).toBeGreaterThan(a0 - square * 0.65)
    expect(b1).toBeGreaterThan(b0 + square * 0.35)
    expect(c1).toBeCloseTo(c0, 0) // the third column is untouched and the total is unchanged
    expect(a1 + b1 + c1).toBeCloseTo(a0 + b0 + c0, 0)
    await expect(tid(page, 'col-tab-0')).toHaveText('1.5x')
    await expect(tid(page, 'col-tab-1')).toHaveText('1.5x')
    await tid(page, 'undo').click()
    expect(await w('cell-0-1')).toBeCloseTo(a0, 0)
  })

  test('a column cannot be dragged below half a square', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    const sep = await center(tid(page, 'sep-1')) // between the two 1x columns
    await page.mouse.move(sep.x, sep.y)
    await page.mouse.down()
    await page.mouse.move(sep.x + 300, sep.y - 0, { steps: 8 })
    await page.mouse.up()
    await expect(tid(page, 'col-tab-1')).toHaveText('1.5x')
    await expect(tid(page, 'col-tab-2')).toHaveText('0.5x')
  })

  test('there is one separator fewer than columns in a down note', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await expect(page.locator('[data-testid^="sep-"]')).toHaveCount(2)
  })
})

test.describe('auto-scroll', () => {
  test('dragging a handle toward the edge scrolls the canvas', async ({ page }) => {
    const rows = Array.from({ length: 24 }, (_, i) => `      - [Item ${i + 1}, "${i}"]`).join('\n')
    await open(page, `title: Long\ncolumns: [2fr, 1fr]\ngroups:\n  - at: [0, 0]\n    variant: plain\n    rows:\n${rows}\n`)
    await edit(page)
    await tid(page, 'group-grip-0').click()
    const scroll = tid(page, 'scroll')
    const box = (await scroll.boundingBox())!
    const corner = await center(tid(page, 'handle-grip'))
    await page.mouse.move(corner.x, corner.y)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 40, { steps: 6 })
    await page.waitForTimeout(500)
    const scrolled = await scroll.evaluate((el) => el.scrollTop)
    await page.mouse.up()
    expect(scrolled).toBeGreaterThan(40)
  })
})
