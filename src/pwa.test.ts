import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(p, 'utf8')
const manifest = JSON.parse(read('public/manifest.webmanifest'))
// A PNG starts with an 8-byte signature, then the IHDR chunk: width and height are the next two 32-bit numbers.
const pngSize = (p: string) => {
  const b = readFileSync(p)
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
}

describe('the web app manifest', () => {
  it('has what browsers need to offer installation', () => {
    expect(manifest).toMatchObject({ name: 'Euclidnote', display: 'standalone', start_url: './', scope: './' })
    expect(manifest.short_name.length).toBeLessThanOrEqual(12)
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i)
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i)
  })
  it('lists real icons of the sizes it claims, including a maskable one', () => {
    const icons = manifest.icons as { src: string; sizes: string; type: string; purpose?: string }[]
    for (const icon of icons) {
      const file = 'public/' + icon.src
      expect(existsSync(file), file).toBe(true)
      if (icon.type === 'image/png') {
        const { w, h } = pngSize(file)
        expect(`${w}x${h}`).toBe(icon.sizes)
      }
    }
    const any = icons.filter((i) => i.purpose === 'any' && i.type === 'image/png').map((i) => i.sizes)
    expect(any).toEqual(expect.arrayContaining(['192x192', '512x512']))
    expect(icons.some((i) => i.purpose === 'maskable' && i.sizes === '512x512')).toBe(true)
  })
  it('uses only paths that work under any base address', () => {
    expect(JSON.stringify(manifest)).not.toMatch(/"(src|start_url|scope|id)": "\//)
    expect(read('public/sw.js')).not.toMatch(/'\/(assets|manifest|favicon|icon)/)
  })
  it('has a home-screen icon for iOS', () => {
    expect(pngSize('public/icon-180.png')).toEqual({ w: 180, h: 180 })
  })
})

describe('the page and the service worker', () => {
  const html = read('index.html')
  it('links the manifest and icons and sets theme colors for both schemes', () => {
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"')
    expect(html).toContain('rel="apple-touch-icon" href="/icon-180.png"')
    expect(html).toContain('rel="icon" href="/favicon.svg"')
    expect(html).toMatch(/theme-color" content="#ece7da" media="\(prefers-color-scheme: light\)"/)
    expect(html).toMatch(/theme-color" content="#121215" media="\(prefers-color-scheme: dark\)"/)
    expect(html).toContain('apple-mobile-web-app-capable')
  })
  it('precaches only files that exist', () => {
    const sw = read('public/sw.js')
    const shell = /const SHELL = \[(.*)\]/.exec(sw)![1].match(/'([^']+)'/g)!.map((s) => s.slice(1, -1))
    expect(shell).toContain('./')
    for (const path of shell.filter((p) => p !== './')) expect(existsSync('public/' + path), path).toBe(true)
  })
})
