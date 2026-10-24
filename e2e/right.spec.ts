import { center, edit, expect, noPageOverflow, open, scrollMetrics, settled, test, tid } from './fixtures'

const cols = Array.from({ length: 8 }, (_, i) => `Day ${i + 1}`)
const row = (cells: string[]) => `      - [${cells.join(', ')}]`
// Three rows by eight columns: wider than any phone, so it has to scroll sideways.
const TRIP = `title: Trip
flow: right
groups:
  - at: [0, 0]
    variant: table
    rows:
${row(cols)}
${row(cols.map(() => 'Morning'))}
${row(cols.map(() => 'Evening'))}
`

test.describe('right flow', () => {
  test.beforeEach(async ({ page }) => {
    await open(page, TRIP)
  })

  test('fits the height and scrolls only horizontally', async ({ page }) => {
    await noPageOverflow(page)
    const m = await scrollMetrics(page)
    expect(m.sw).toBeGreaterThan(m.cw)
    expect(m.sh).toBeLessThanOrEqual(m.ch)
  })

  test('scrolls freely, not in pages', async ({ page }) => {
    const scroll = tid(page, 'scroll')
    await scroll.evaluate((el) => { el.scrollLeft = 123 })
    await page.waitForTimeout(100)
    expect(await scroll.evaluate((el) => el.scrollLeft)).toBeCloseTo(123, 0)
  })

  test('rows divide the height and cells are roughly square', async ({ page }) => {
    await settled(page)
    const area = (await tid(page, 'scroll').boundingBox())!
    const last = (await tid(page, 'cell-0-2').boundingBox())!
    expect(last.y + last.height).toBeLessThanOrEqual(area.y + area.height - 60) // leaves the dock zone clear
    const cell = (await tid(page, 'cell-0-0').boundingBox())!
    expect(Math.abs(cell.width - cell.height)).toBeLessThan(cell.height * 0.15)
  })

  test('fades the edge that has more content', async ({ page }) => {
    const scroll = tid(page, 'scroll')
    await expect(scroll).toHaveAttribute('data-fade-end', 'true')
    await expect(scroll).toHaveAttribute('data-fade-start', 'false')
    await scroll.evaluate((el) => { el.scrollLeft = el.scrollWidth })
    await expect(scroll).toHaveAttribute('data-fade-end', 'false')
    await expect(scroll).toHaveAttribute('data-fade-start', 'true')
  })

  test('entering edit mode does not change the cell size', async ({ page }) => {
    await settled(page)
    const before = await tid(page, 'cell-0-0').boundingBox()
    await edit(page)
    await settled(page)
    expect(await tid(page, 'cell-0-0').boundingBox()).toEqual(before)
  })

  test('there is a separator per column, and dragging one resizes just that column', async ({ page }) => {
    await edit(page)
    await settled(page)
    await expect(page.locator('[data-testid^="sep-"]')).toHaveCount(8)
    const w = async (id: string) => (await tid(page, id).boundingBox())!.width
    const [a0, b0] = [await w('cell-0-0'), await w('cell-1-0')]
    const sep = await center(tid(page, 'sep-0'))
    await page.mouse.move(sep.x, sep.y)
    await page.mouse.down()
    await page.mouse.move(sep.x + a0 * 0.2, sep.y, { steps: 3 }) // under a quarter square: no change
    expect(await w('cell-0-0')).toBeCloseTo(a0, 0)
    await page.mouse.move(sep.x + a0 * 0.55, sep.y, { steps: 4 })
    await page.mouse.up()
    await settled(page)
    expect(await w('cell-0-0')).toBeGreaterThan(a0 * 1.4)
    expect(await w('cell-0-0')).toBeLessThan(a0 * 1.6)
    expect(await w('cell-1-0')).toBeCloseTo(b0, 0) // only that column changes
  })

  test('dragging to the right edge auto-scrolls', async ({ page }) => {
    await edit(page)
    await tid(page, 'group-grip-0').click()
    await settled(page)
    const scroll = tid(page, 'scroll')
    const box = (await scroll.boundingBox())!
    const h = await center(tid(page, 'handle-grip'))
    await page.mouse.move(h.x, h.y)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width - 20, h.y, { steps: 6 })
    await page.waitForTimeout(600)
    const sl = await scroll.evaluate((el) => el.scrollLeft)
    await page.mouse.up()
    expect(sl).toBeGreaterThan(50)
  })

  test('switching to scroll-down is refused: eight columns cannot fit across', async ({ page }) => {
    await edit(page)
    await tid(page, 'tool-layout').click()
    await expect(tid(page, 'flow-down')).toBeDisabled()
    await expect(tid(page, 'flow-hint')).toContainText('at most 5 columns')
  })
})
