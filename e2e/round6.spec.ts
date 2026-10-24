import { edit, expect, open, settled, test, tid } from './fixtures'

const GRID = `title: G
columns: [1fr, 1fr, 1fr]
groups:
  - at: [0, 0]
    variant: card
    rows:
      - [a, b, c]
      - [d, e, f]
      - [g, h, i]
`

test.describe('shrinking a group from a cell', () => {
  test('Delete row removes the cell’s row and keeps a cell selected', async ({ page }) => {
    await open(page, GRID)
    await edit(page)
    await tid(page, 'cell-1-1').click()
    await tid(page, 'tool-delete-row').click()
    await expect(page.locator('[data-testid^="cell-"]')).toHaveCount(6)
    await expect(tid(page, 'selection')).toHaveAttribute('data-kind', 'cell')
  })

  test('Delete column removes the cell’s column from every row', async ({ page }) => {
    await open(page, GRID)
    await edit(page)
    await tid(page, 'cell-1-1').click()
    await tid(page, 'tool-delete-column').click()
    await expect(page.locator('[data-testid^="cell-"]')).toHaveCount(6)
    await expect(tid(page, 'cell-2-0')).toHaveCount(0)
  })

  test('deleting the last row deletes the group, and undo brings it back', async ({ page }) => {
    await open(page, 'title: G\ncolumns: [1fr, 1fr]\ngroups:\n  - at: [0, 0]\n    rows:\n      - [a, b]\n')
    await edit(page)
    await tid(page, 'cell-0-0').click()
    await tid(page, 'tool-delete-row').click()
    await expect(page.locator('[data-testid^="cell-"]')).toHaveCount(0)
    await tid(page, 'undo').click()
    await expect(page.locator('[data-testid^="cell-"]')).toHaveCount(2)
  })
})

test.describe('popups dim the app', () => {
  test('a sheet dims everything, without blocking taps, and goes away with it', async ({ page }, info) => {
    test.skip(info.project.name === 'wide', 'wide screens use the inspector')
    await open(page)
    await edit(page)
    await expect(tid(page, 'pop-scrim')).toHaveCount(0)
    await tid(page, 'cell-0-1').click()
    await tid(page, 'tool-format').click()
    const scrim = tid(page, 'pop-scrim')
    await expect(scrim).toBeVisible()
    expect(await scrim.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none')
    await page.keyboard.press('Escape')
    await expect(scrim).toHaveCount(0)
  })
})

test.describe('the first group’s grip', () => {
  test('sits across its top edge like every other group’s, clear of the column controls', async ({ page }) => {
    await open(page, 'title: G\ncolumns: [1fr, 1fr]\ngroups:\n  - at: [0, 0]\n    rows:\n      - [a, b]\n  - at: [0, 2]\n    rows:\n      - [c, d]\n')
    await edit(page)
    await settled(page)
    const pill = async (i: number) => (await tid(page, `group-grip-${i}`).locator('.pill').boundingBox())!
    const top = async (id: string) => (await tid(page, id).boundingBox())!.y
    const first = await pill(0)
    const other = await pill(1)
    // the same place relative to the group's top edge as a group lower down
    expect(Math.abs(first.y - (await top('cell-0-0')) - (other.y - (await top('cell-0-2'))))).toBeLessThan(1.5)
    // and not on top of the column chips
    const tab = (await tid(page, 'col-tab-0').boundingBox())!
    expect(first.y).toBeGreaterThanOrEqual(tab.y + tab.height)
  })
})

test.describe('header', () => {
  test('the title is centered with the buttons beside it', async ({ page }) => {
    await open(page)
    await settled(page)
    const title = await tid(page, 'title').evaluate((el) => {
      const r = document.createRange()
      r.selectNodeContents(el)
      const b = r.getBoundingClientRect()
      return b.y + b.height / 2
    })
    const btn = (await tid(page, 'mode-toggle').boundingBox())!
    // the caps of a condensed font sit high in their line box; the nudge brings them within a few pixels
    expect(Math.abs(title - (btn.y + btn.height / 2))).toBeLessThan(9)
  })
})
