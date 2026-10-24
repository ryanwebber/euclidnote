import { edit, expect, open, settled, test, tid } from './fixtures'

const TILES = `title: T
columns: [1fr, 1fr]
groups:
  - at: [0, 0]
    variant: tiles
    rows:
      - [{counter: 4, goal: 12, label: Sets, fill: yellow}, {timer: 0, label: Rest, fill: indigo}]
`

const LIST = `title: L
columns: [1fr]
groups:
  - at: [0, 0]
    variant: card
    rows:
      - [{habit: [1, 0, 0, 0, 0, 0, 0], label: Run}]
      - [{habit: [1, 1, 1, 0, 0, 0, 0], label: Stretching}]
`

test.describe('widget layout', () => {
  test('tile widgets are centered in their cell', async ({ page }) => {
    await open(page, TILES)
    await settled(page)
    const cell = (await tid(page, 'cell-0-0').boundingBox())!
    const value = (await tid(page, 'cell-0-0').locator('.value').boundingBox())!
    expect(Math.abs(value.x + value.width / 2 - (cell.x + cell.width / 2))).toBeLessThan(4)
  })

  test('captioned list rows start their controls at the same place', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'needs a wide cell')
    await open(page, LIST)
    await settled(page)
    const a = (await tid(page, 'cell-0-0').locator('.days').boundingBox())!
    const b = (await tid(page, 'cell-0-1').locator('.days').boundingBox())!
    expect(Math.abs(a.x - b.x)).toBeLessThan(1)
  })

  test('the Layout setting changes the arrangement', async ({ page }) => {
    await open(page, TILES)
    await edit(page)
    await tid(page, 'cell-0-0').click()
    await tid(page, 'tool-widget').click()
    await expect(tid(page, 'cell-0-0')).toHaveAttribute('data-arrange', 'center')
    await tid(page, 'layout-start').click()
    await expect(tid(page, 'cell-0-0')).toHaveAttribute('data-arrange', 'start')
    await tid(page, 'layout-auto').click()
    await expect(tid(page, 'cell-0-0')).toHaveAttribute('data-arrange', 'center')
  })
})

test.describe('chart', () => {
  const CHART = `title: C\ncolumns: [1fr, 1fr]\ncells:\n  - {at: [0, 0], span: 2, bars: [1, 2, 3, 4, 5, 6, 7], max: 10, axis: week, label: Week}\n`
  test('a week chart is labelled; switching to custom drops the labels and lets you set the count', async ({ page }) => {
    await open(page, CHART)
    await expect(tid(page, 'cell-0-0').locator('.axis')).toHaveCount(1)
    await edit(page)
    await tid(page, 'cell-0-0').click()
    await tid(page, 'tool-widget').click()
    await expect(tid(page, 'setting-bars')).toHaveCount(0)
    await tid(page, 'chart-custom').click()
    await tid(page, 'setting-bars').fill('5')
    await expect(tid(page, 'cell-0-0').locator('.bar')).toHaveCount(5)
    await expect(tid(page, 'cell-0-0').locator('.axis')).toHaveCount(0)
    await tid(page, 'chart-week').click()
    await expect(tid(page, 'cell-0-0').locator('.bar')).toHaveCount(7)
    await expect(tid(page, 'cell-0-0').locator('.axis')).toHaveCount(1)
  })
})
