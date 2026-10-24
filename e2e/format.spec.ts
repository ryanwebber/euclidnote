import { STARTER, edit, expect, open, settled, test, tid } from './fixtures'

const LOOSE = `title: Loose
columns: [1fr, 1fr, 1fr]
cells:
  - {at: [0, 0], text: Hello}
`

const select = async (page: import('@playwright/test').Page, id = 'cell-0-0') => {
  await edit(page)
  await tid(page, id).click()
}

test.describe('text styling (Style sheet)', () => {
  test('bold, italic, underline, strike, alignment and size', async ({ page }) => {
    await open(page, LOOSE)
    await select(page)
    const cell = tid(page, 'cell-0-0')
    await tid(page, 'tool-format').click()
    await expect(tid(page, 'pop-format')).toBeVisible()
    await tid(page, 'style-bold').click()
    await expect(cell).toHaveCSS('font-weight', '700')
    await tid(page, 'style-italic').click()
    await expect(cell).toHaveCSS('font-style', 'italic')
    await tid(page, 'style-underline').click()
    await expect(cell).toHaveAttribute('data-underline', 'true')
    await tid(page, 'style-strike').click()
    await expect(cell).toHaveAttribute('data-strike', 'true')
    await tid(page, 'align-center').click()
    await expect(cell).toHaveCSS('text-align', 'center')
    await tid(page, 'size-title').click()
    await expect(cell).toHaveAttribute('data-size', 'title')
    await tid(page, 'size-normal').click()
    await expect(cell).not.toHaveAttribute('data-size', /.+/)
    // Toggling everything off returns to the plain style, which stores nothing.
    for (const id of ['style-bold', 'style-italic', 'style-underline', 'style-strike', 'align-left']) await tid(page, id).click()
    await expect(cell).not.toHaveCSS('font-weight', '700')
    await expect(cell).not.toHaveAttribute('data-underline', 'true')
  })

  test('the sheet shows the current state', async ({ page }) => {
    await open(page, STARTER)
    await select(page, 'cell-0-1')
    await tid(page, 'tool-format').click()
    await expect(tid(page, 'style-bold')).toHaveAttribute('aria-pressed', 'true')
    await expect(tid(page, 'style-italic')).toHaveAttribute('aria-pressed', 'false')
    await expect(tid(page, 'align-left')).toHaveAttribute('aria-pressed', 'true')
    await expect(tid(page, 'font-sans')).toHaveAttribute('aria-pressed', 'true')
  })

  test('fonts change the typeface', async ({ page }) => {
    await open(page, LOOSE)
    await select(page)
    const cell = tid(page, 'cell-0-0')
    await tid(page, 'tool-format').click()
    const family = () => cell.evaluate((el) => getComputedStyle(el).fontFamily)
    const sans = await family()
    await tid(page, 'font-mono').click()
    await expect(cell).toHaveAttribute('data-font', 'mono')
    expect(await family()).toMatch(/mono|menlo|consolas/i)
    await tid(page, 'font-serif').click()
    expect(await family()).toMatch(/serif|georgia|new york|iowan/i)
    await tid(page, 'font-rounded').click()
    await expect(cell).toHaveAttribute('data-font', 'rounded')
    await tid(page, 'font-display').click()
    await expect(cell).toHaveAttribute('data-font', 'display')
    await expect(cell).toHaveCSS('text-transform', 'uppercase')
    await tid(page, 'font-sans').click()
    await expect(cell).not.toHaveAttribute('data-font', /.+/)
    expect(await family()).toBe(sans)
  })

  test('borders: thin, thick and dashed', async ({ page }) => {
    await open(page, LOOSE)
    await select(page)
    const cell = tid(page, 'cell-0-0')
    await tid(page, 'tool-format').click()
    await tid(page, 'border-thin').click()
    await expect(cell).toHaveAttribute('data-border', 'thin')
    expect(await cell.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none')
    await tid(page, 'border-dashed').click()
    await expect(cell).toHaveCSS('outline-style', 'dashed')
    await tid(page, 'border-none').click()
    await expect(cell).not.toHaveAttribute('data-border', /.+/)
  })

  test('text color tints the text', async ({ page }) => {
    await open(page, LOOSE)
    await select(page)
    const cell = tid(page, 'cell-0-0')
    const before = await cell.evaluate((el) => getComputedStyle(el).color)
    await tid(page, 'tool-format').click()
    await tid(page, 'text-color-red').click()
    await expect(cell).toHaveAttribute('data-color', 'red')
    expect(await cell.evaluate((el) => getComputedStyle(el).color)).not.toBe(before)
    await tid(page, 'text-color-none').click()
    await expect(cell).not.toHaveAttribute('data-color', /.+/)
  })

  test('an icon appears before the text, and can be removed', async ({ page }) => {
    await open(page, LOOSE)
    await select(page)
    const cell = tid(page, 'cell-0-0')
    await expect(cell.locator('.icon')).toHaveCount(0)
    await tid(page, 'tool-format').click()
    await tid(page, 'icon-dumbbell').click()
    await expect(cell.locator('.icon svg')).toHaveCount(1)
    await tid(page, 'icon-star').click() // replaces
    await expect(cell.locator('.icon svg')).toHaveCount(1)
    await tid(page, 'icon-none').click()
    await expect(cell.locator('.icon')).toHaveCount(0)
  })

  test('every icon is offered', async ({ page }) => {
    await open(page, LOOSE)
    await select(page)
    await tid(page, 'tool-format').click()
    for (const name of ['star', 'heart', 'flag', 'bolt', 'check', 'clock', 'calendar', 'pin', 'cart', 'gift', 'dumbbell', 'fire', 'drop', 'sun', 'moon', 'note', 'dollar', 'plane', 'bed', 'fork']) {
      await expect(tid(page, `icon-${name}`)).toBeAttached()
    }
  })

  test('each change is one undo step', async ({ page }) => {
    await open(page, LOOSE)
    await select(page)
    await tid(page, 'tool-format').click()
    await tid(page, 'style-bold').click()
    await tid(page, 'undo').click()
    await expect(tid(page, 'cell-0-0')).not.toHaveCSS('font-weight', '700')
  })
})

test.describe('fill', () => {
  test('applies a tint and can be cleared', async ({ page }) => {
    await open(page, LOOSE)
    await select(page)
    const cell = tid(page, 'cell-0-0')
    await tid(page, 'tool-fill').click()
    await tid(page, 'fill-blue').click()
    await expect(cell).toHaveAttribute('data-fill', 'blue')
    expect(await cell.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)')
    await tid(page, 'fill-none').click()
    await expect(cell).not.toHaveAttribute('data-fill', /.+/)
  })

  test('every fill is offered (thirteen colors)', async ({ page }) => {
    await open(page, LOOSE)
    await select(page)
    await tid(page, 'tool-fill').click()
    for (const f of ['none', 'red', 'orange', 'yellow', 'lime', 'green', 'teal', 'blue', 'indigo', 'purple', 'pink', 'sand', 'gray', 'ink']) await expect(tid(page, `fill-${f}`)).toBeVisible()
  })
})

test.describe('group looks', () => {
  const looks = ['plain', 'card', 'table', 'header', 'sidebar', 'stripe', 'stack', 'tiles', 'outline']

  test('all nine looks are offered and apply', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'group-grip-0').click()
    await tid(page, 'tool-look').click()
    for (const look of looks) {
      await expect(tid(page, `look-${look}`)).toBeVisible()
      await tid(page, `look-${look}`).click()
      await expect(tid(page, 'cell-0-1')).toHaveAttribute('data-variant', look)
      await expect(tid(page, `look-${look}`)).toHaveAttribute('aria-pressed', 'true')
    }
  })

  test('a card draws one surface around the whole group; a stack draws one per row', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'group-grip-0').click()
    await tid(page, 'tool-look').click()
    await tid(page, 'look-card').click()
    await expect(page.locator('.panel')).toHaveCount(1)
    await expect(page.locator('.row-card')).toHaveCount(0)
    await settled(page)
    const a = (await tid(page, 'cell-0-1').boundingBox())!
    const panel = (await page.locator('.panel').boundingBox())!
    const b = (await tid(page, 'cell-2-2').boundingBox())!
    expect(panel.y).toBeLessThanOrEqual(a.y + 1)
    expect(panel.y + panel.height).toBeGreaterThanOrEqual(b.y + b.height - 1)
    await tid(page, 'look-stack').click()
    await expect(page.locator('.panel')).toHaveCount(0)
    await expect(page.locator('.row-card')).toHaveCount(2)
  })

  test('the asymmetric looks set off one edge: header the top row, sidebar the first column, stripe the left edge', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'group-grip-0').click()
    await tid(page, 'tool-look').click()
    await tid(page, 'look-header').click()
    await expect(page.locator('.head-band')).toHaveCount(1)
    await expect(page.locator('.side-band')).toHaveCount(0)
    await tid(page, 'look-sidebar').click()
    await expect(page.locator('.side-band')).toHaveCount(1)
    await expect(page.locator('.head-band')).toHaveCount(0)
    await tid(page, 'look-stripe').click()
    await expect(page.locator('.stripe')).toHaveCount(1)
    await tid(page, 'look-tiles').click()
    expect(await tid(page, 'cell-0-1').evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none')
  })

  test('the retired looks still load, as their nearest relative', async ({ page }) => {
    await open(page, `title: Old\ngroups:\n  - at: [0, 0]\n    variant: banded\n    rows:\n      - [a, b]\n  - at: [0, 3]\n    variant: list\n    rows:\n      - [c, d]\n`)
    await expect(tid(page, 'cell-0-0')).toHaveAttribute('data-variant', 'header')
    await expect(tid(page, 'cell-0-3')).toHaveAttribute('data-variant', 'table')
  })

  test('a tint colors the group surface', async ({ page }) => {
    await open(page, STARTER)
    await edit(page)
    await tid(page, 'group-grip-0').click()
    await tid(page, 'tool-look').click()
    await tid(page, 'look-card').click()
    const bg = () => page.locator('.panel').evaluate((el) => getComputedStyle(el).backgroundColor)
    const plain = await bg()
    await tid(page, 'group-fill-green').click()
    expect(await bg()).not.toBe(plain)
    await tid(page, 'group-fill-none').click()
    expect(await bg()).toBe(plain)
  })

  test('the old look names in a saved note still render', async ({ page }) => {
    await open(page, `title: Old\ngroups:\n  - at: [0, 0]\n    variant: cards\n    rows:\n      - [a, b]\n`)
    await expect(tid(page, 'cell-0-0')).toHaveAttribute('data-variant', 'stack')
  })
})

test.describe('editing background', () => {
  test('a dot matrix shows while editing and steps in half cells', async ({ page }) => {
    await open(page, STARTER)
    const bg = () => tid(page, 'grid').evaluate((el) => getComputedStyle(el, '::before').backgroundImage)
    expect(await bg()).toBe('none')
    await edit(page)
    expect(await bg()).toContain('radial-gradient')
    // the pitch is half a cell plus half a gap, so dots land on cell edges and centers
    const pitch = await tid(page, 'grid').evaluate((el) => Number.parseFloat(getComputedStyle(el, '::before').backgroundSize))
    await settled(page)
    const b = (await tid(page, 'cell-1-1').boundingBox())!
    expect(Math.abs(pitch * 2 - (b.width + 12))).toBeLessThan(1)
    await edit(page)
    expect(await bg()).toBe('none')
  })
})
