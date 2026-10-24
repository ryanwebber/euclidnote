import { STARTER, edit, expect, open, test, tid } from './fixtures'

const LIST = `title: List
columns: [2fr, 1fr]
cells:
  - {at: [0, 0], span: 2, text: Fruit, bold: true}
groups:
  - at: [0, 1]
    variant: plain
    rows:
      - [Plum, "3"]
      - [Pear, "2"]
`

test.describe('selecting', () => {
  test('tapping a cell selects it and offers text tools; tapping the canvas clears it', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await expect(tid(page, 'tool-add')).toBeVisible()
    await tid(page, 'cell-0-1').click()
    await expect(tid(page, 'selection')).toHaveAttribute('data-kind', 'cell')
    await expect(tid(page, 'tool-format')).toBeVisible()
    await expect(tid(page, 'tool-add')).toHaveCount(0)
    // bare canvas below the content
    await page.mouse.click(3, (await tid(page, 'scroll').boundingBox())!.y + 400)
    await expect(tid(page, 'selection')).toHaveCount(0)
    await expect(tid(page, 'tool-add')).toBeVisible()
  })

  test('a grouped cell offers a grip that selects its group', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'cell-0-1').click()
    await tid(page, 'handle-grip').click()
    await expect(tid(page, 'selection')).toHaveAttribute('data-kind', 'group')
    await expect(tid(page, 'tool-look')).toBeVisible()
  })

  test('tapping a group grip selects the group', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'group-grip-0').click()
    await expect(tid(page, 'selection')).toHaveAttribute('data-kind', 'group')
    for (const k of ['grip', 'top', 'bottom', 'left', 'right', 'corner']) {
      await expect(tid(page, `handle-${k}`)).toBeVisible()
    }
  })

  test('leaving edit mode clears the selection', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'cell-0-1').click()
    await edit(page)
    await expect(tid(page, 'selection')).toHaveCount(0)
  })

  test('arrow keys move the selection between cells; Escape clears it', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'cell-0-0').click()
    await page.keyboard.press('ArrowDown')
    await expect(tid(page, 'cell-0-1')).toHaveAttribute('data-selected', 'true')
    await page.keyboard.press('ArrowRight')
    await expect(tid(page, 'cell-1-1')).toHaveAttribute('data-selected', 'true')
    await page.keyboard.press('ArrowUp') // the heading spans over it
    await expect(tid(page, 'cell-0-0')).toHaveAttribute('data-selected', 'true')
    await page.keyboard.press('Escape')
    await expect(tid(page, 'selection')).toHaveCount(0)
  })
})

test.describe('typing', () => {
  test('tap selects, tap again edits; the text is saved', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'cell-0-1').click()
    await expect(tid(page, 'text-editor')).toHaveCount(0)
    await tid(page, 'cell-0-1').click()
    await expect(tid(page, 'text-editor')).toBeFocused()
    await page.keyboard.type(' press')
    await page.keyboard.press('Escape')
    await expect(tid(page, 'text-editor')).toHaveCount(0)
    await expect(tid(page, 'cell-0-1')).toContainText('Squat press')
    await page.reload()
    await expect(tid(page, 'cell-0-1')).toContainText('Squat press')
  })

  test('Return moves down a column; in the last row of a group it adds a row like it', async ({ page }) => {
    await open(page, LIST)
    await edit(page)
    await tid(page, 'cell-0-1').click()
    await tid(page, 'cell-0-1').click()
    await page.keyboard.press('Enter')
    await expect(tid(page, 'cell-0-2').getByTestId('text-editor')).toBeFocused()
    await page.keyboard.press('Enter') // last row: grows the group
    await expect(tid(page, 'cell-0-3').getByTestId('text-editor')).toBeFocused()
    await page.keyboard.type('Plum')
    await page.keyboard.press('Tab')
    await expect(tid(page, 'cell-1-3').getByTestId('text-editor')).toBeFocused()
    await page.keyboard.type('5')
    await page.keyboard.press('Escape')
    await expect(tid(page, 'cell-0-3')).toContainText('Plum')
    await expect(tid(page, 'cell-1-3')).toContainText('5')
    // one undo removes the whole new row? No: typing and the new row are separate steps.
    await tid(page, 'undo').click()
    await tid(page, 'undo').click()
    await expect(tid(page, 'cell-0-3')).toHaveCount(0)
  })

  test('Return on a loose cell just finishes', async ({ page }) => {
    await open(page, LIST)
    await edit(page)
    await tid(page, 'cell-0-0').click()
    await tid(page, 'cell-0-0').click()
    await page.keyboard.press('Enter')
    // the heading sits above the group, so Return moves into the group
    await expect(tid(page, 'cell-0-1').getByTestId('text-editor')).toBeFocused()
  })

  test('Shift-Return inserts a line break', async ({ page }) => {
    await open(page, LIST)
    await edit(page)
    await tid(page, 'cell-0-1').click()
    await tid(page, 'cell-0-1').click()
    await page.keyboard.press('Shift+Enter')
    await page.keyboard.type('x')
    await expect(tid(page, 'text-editor')).toHaveValue('Plum\nx')
  })

  test('tapping an empty slot adds a cell and starts editing it', async ({ page }) => {
    await open(page, LIST)
    await edit(page)
    await tid(page, 'slot-0-3').click()
    await expect(tid(page, 'cell-0-3').getByTestId('text-editor')).toBeFocused()
    await page.keyboard.type('Milk')
    await page.keyboard.press('Escape')
    await expect(tid(page, 'cell-0-3')).toContainText('Milk')
  })

  test('the title is renamed in place', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'title-input').fill('Push day')
    await edit(page)
    await expect(tid(page, 'title')).toHaveText('Push day')
  })
})

test.describe('undo and redo', () => {
  test('undo and redo walk through edits, including from the keyboard', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await expect(tid(page, 'undo')).toBeDisabled()
    await tid(page, 'title-input').fill('A')
    await expect(tid(page, 'undo')).toBeEnabled()
    await tid(page, 'undo').click()
    await expect(tid(page, 'title-input')).toHaveValue('Leg day')
    await expect(tid(page, 'redo')).toBeEnabled()
    await tid(page, 'redo').click()
    await expect(tid(page, 'title-input')).toHaveValue('A')
    await tid(page, 'cell-0-1').click()
    await page.keyboard.press('ControlOrMeta+z')
    await expect(tid(page, 'title-input')).toHaveValue('Leg day')
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect(tid(page, 'title-input')).toHaveValue('A')
  })

  test('typing in one go is one undo step', async ({ page }) => {
    await open(page, LIST)
    await edit(page)
    await tid(page, 'cell-0-1').click()
    await tid(page, 'cell-0-1').click()
    await page.keyboard.type(' pie')
    await page.keyboard.press('Escape')
    await tid(page, 'undo').click()
    await expect(tid(page, 'cell-0-1')).toHaveText('Plum')
  })

  test('undo survives a selection that no longer exists', async ({ page }) => {
    await open(page, LIST)
    await edit(page)
    await tid(page, 'slot-0-3').click()
    await page.keyboard.press('Escape')
    await tid(page, 'undo').click()
    await expect(tid(page, 'cell-0-3')).toHaveCount(0)
    await expect(tid(page, 'selection')).toHaveCount(0)
  })
})

test.describe('deleting', () => {
  test('a loose cell can be deleted from the dock or the keyboard; a grouped cell cannot', async ({ page }) => {
    await open(page, LIST)
    await edit(page)
    await tid(page, 'cell-0-1').click()
    await expect(tid(page, 'tool-delete')).toHaveCount(0)
    await tid(page, 'cell-0-0').click()
    await tid(page, 'tool-delete').click()
    await expect(tid(page, 'cell-0-0')).toHaveCount(0)
    await tid(page, 'undo').click()
    await expect(tid(page, 'cell-0-0')).toBeVisible()
    await tid(page, 'cell-0-0').click()
    await page.keyboard.press('Delete')
    await expect(tid(page, 'cell-0-0')).toHaveCount(0)
  })

  test('a group can be deleted or ungrouped', async ({ page }) => {
    await open(page, LIST)
    await edit(page)
    await tid(page, 'group-grip-0').click()
    await tid(page, 'tool-ungroup').click()
    await expect(tid(page, 'selection')).toHaveCount(0)
    await expect(tid(page, 'cell-0-1')).toBeVisible()
    await expect(tid(page, 'group-grip-0')).toHaveCount(0)
    await tid(page, 'undo').click()
    await tid(page, 'group-grip-0').click()
    await tid(page, 'tool-delete').click()
    await expect(tid(page, 'cell-0-1')).toHaveCount(0)
  })
})
