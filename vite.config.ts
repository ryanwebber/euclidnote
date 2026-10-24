import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import pkg from './package.json' with { type: 'json' }

// Tell the service worker which files the build made, so the first visit stores the whole app for offline use
// (not just what that visit happened to load), and name its cache after them so an update replaces the old one.
function precache(): Plugin {
  let out = ''
  return {
    name: 'precache-built-files',
    apply: 'build',
    configResolved(config) {
      out = join(config.root, config.build.outDir)
    },
    closeBundle() {
      const assets = readdirSync(join(out, 'assets')).sort().map((f) => `assets/${f}`)
      const version = createHash('sha1').update(assets.join('\n')).digest('hex').slice(0, 10)
      const file = join(out, 'sw.js')
      const sw = readFileSync(file, 'utf8')
      if (!sw.includes('const ASSETS = []') || !sw.includes("'euclidnote-dev'")) throw new Error('sw.js no longer has the placeholders precache-built-files fills in')
      writeFileSync(file, sw.replace('const ASSETS = []', `const ASSETS = ${JSON.stringify(assets)}`).replace("'euclidnote-dev'", `'euclidnote-${version}'`))
    },
  }
}

export default defineConfig({
  // The address the app is served from. A site published under /<repo>/ sets BASE_PATH; everywhere else it is /.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), precache()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
