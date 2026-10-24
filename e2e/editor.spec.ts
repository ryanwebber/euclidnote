import { center, edit, expect, open, settled, test, tid } from './fixtures'

const LIST = `title: L
columns: [1fr, 1fr]
cells:
  - {at: [0, 0], span: 2, text: Heading, bold: true}
groups:
  - at: [0, 1]
    variant: card
    rows:
      - [One, a]
      - [Two, b]
      - [Three, c]
`

// Press, hold still, then drag: how a finger lifts something.
async function longPressDrag(page: import('@playwright/test').Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.waitForTimeout(600)
  await page.mouse.move(to.x, to.y, { steps: 10 })
  await page.mouse.up()
}

test.describe('making room (insert and push)', () => {
  test('Add row pushes what is below it instead of doing nothing', async ({ page }) => {
    await open(page, 'title: P\ncolumns: [1fr, 1fr]\ncells:\n  - {at: [0, 2], span: 2, text: Below}\ngroups:\n  - at: [0, 0]\n    rows:\n      - [a, b]\n      - [c, d]\n')
    await edit(page)
    await tid(page, 'cell-0-1').click() // the group's last row
    await tid(page, 'tool-add-row').click()
    await expect(tid(page, 'cell-0-2')).toHaveText('') // the new row
    await expect(tid(page, 'cell-0-3')).toContainText('Below')
  })

  test('dragging a group’s bottom dot onto the next item pushes it', async ({ page }) => {
    await open(page, 'title: P\ncolumns: [1fr, 1fr]\ncells:\n  - {at: [0, 2], span: 2, text: Below}\ngroups:\n  - at: [0, 0]\n    rows:\n      - [a, b]\n      - [c, d]\n')
    await edit(page)
    await tid(page, 'group-grip-0').click()
    const dot = await center(tid(page, 'handle-bottom'))
    const target = await center(tid(page, 'cell-0-2'))
    await page.mouse.move(dot.x, dot.y)
    await page.mouse.down()
    await page.mouse.move(target.x, target.y + 10, { steps: 10 })
    await expect(tid(page, 'ghost')).toHaveAttribute('data-valid', 'true')
    await page.mouse.up()
    await expect(page.locator('[data-testid^="cell-"]')).toHaveCount(9) // the copy brings four cells
    await expect(page.locator('[data-testid^="cell-"]').filter({ hasText: 'Below' })).toHaveCount(1)
  })
})

test.describe('reordering rows', () => {
  test('drag the grip of a selected cell to move its row', async ({ page }) => {
    await open(page, LIST)
    await edit(page)
    await tid(page, 'cell-0-1').click()
    await settled(page)
    await expect(tid(page, 'selection')).toBeVisible()
    const grip = await center(tid(page, 'handle-grip'))
    const target = await center(tid(page, 'cell-0-3'))
    await page.mouse.move(grip.x, grip.y)
    await page.mouse.down()
    await page.mouse.move(target.x, target.y, { steps: 10 })
    await expect(tid(page, 'ghost')).toBeVisible()
    await page.mouse.up()
    await expect(tid(page, 'cell-0-1')).toContainText('Two')
    await expect(tid(page, 'cell-0-2')).toContainText('Three')
    await expect(tid(page, 'cell-0-3')).toContainText('One')
    await expect(tid(page, 'cell-0-3')).toHaveAttribute('data-selected', 'true') // it stays selected
    await tid(page, 'undo').click()
    await expect(tid(page, 'cell-0-1')).toContainText('One')
  })

  test('a plain tap on that grip still selects the group', async ({ page }) => {
    await open(page, LIST)
    await edit(page)
    await tid(page, 'cell-0-2').click()
    await tid(page, 'handle-grip').click()
    await expect(tid(page, 'selection')).toHaveAttribute('data-kind', 'group')
  })

  test('Alt + arrow keys move the row', async ({ page }) => {
    await open(page, LIST)
    await edit(page)
    await tid(page, 'cell-0-1').click()
    await page.keyboard.press('Alt+ArrowDown')
    await expect(tid(page, 'cell-0-2')).toContainText('One')
    await expect(tid(page, 'cell-0-2')).toHaveAttribute('data-selected', 'true')
    await page.keyboard.press('Alt+ArrowUp')
    await expect(tid(page, 'cell-0-1')).toContainText('One')
    await page.keyboard.press('Alt+ArrowUp') // already first
    await expect(tid(page, 'cell-0-1')).toContainText('One')
  })
})

test.describe('long press to lift', () => {
  test('holding a selected cell in a group lifts its row', async ({ page }) => {
    await open(page, LIST)
    await edit(page)
    await tid(page, 'cell-0-3').click()
    await settled(page)
    const from = await center(tid(page, 'cell-0-3'))
    const to = await center(tid(page, 'cell-0-1'))
    await longPressDrag(page, from, to)
    await expect(tid(page, 'cell-0-1')).toContainText('Three')
    await expect(tid(page, 'cell-0-2')).toContainText('One')
    // letting go did not start editing the text
    await expect(page.locator('textarea, input[data-testid="label-editor"], [contenteditable="true"]')).toHaveCount(0)
  })

  test('holding a selected loose cell lifts it to a new spot', async ({ page }) => {
    await open(page, 'title: M\ncolumns: [1fr, 1fr]\ncells:\n  - {at: [0, 0], text: Mover}\n')
    await edit(page)
    await tid(page, 'cell-0-0').click()
    await settled(page)
    const from = await center(tid(page, 'cell-0-0'))
    const to = await center(tid(page, 'slot-1-1'))
    await longPressDrag(page, from, to)
    await expect(tid(page, 'cell-1-1')).toContainText('Mover')
    await expect(tid(page, 'cell-0-0')).toHaveCount(0)
  })

  test('pressing and moving at once is left alone (that is a scroll), and nothing lifts', async ({ page }) => {
    await open(page, LIST)
    await edit(page)
    await tid(page, 'cell-0-1').click()
    await settled(page)
    const from = await center(tid(page, 'cell-0-1'))
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(from.x, from.y + 30, { steps: 4 })
    await page.waitForTimeout(600)
    await page.mouse.up()
    await expect(tid(page, 'cell-0-1')).toContainText('One')
    await expect(tid(page, 'cell-0-1')).not.toHaveAttribute('data-lifted', 'true')
  })

  test('a cell that is not selected is not lifted by holding it', async ({ page }) => {
    await open(page, LIST)
    await edit(page)
    const from = await center(tid(page, 'cell-0-1'))
    const to = await center(tid(page, 'cell-0-3'))
    await longPressDrag(page, from, to)
    await expect(tid(page, 'cell-0-1')).toContainText('One')
  })
})
