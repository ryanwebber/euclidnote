// Manage the dev library. The notes live in the browser's storage, so this opens the running dev
// server with a `?seed=` command that the app applies on load (dev builds only) and then removes.
//   npm run seed          add any example notes that are missing
//   npm run seed:reset    wipe every note and load all the examples fresh
//   npm run seed:clear    wipe every note, leaving the library empty
// The port defaults to 5173; set PORT to match your dev server.
import { execFileSync } from 'node:child_process'

const action = process.argv[2] ?? 'add'
if (!['add', 'reset', 'clear'].includes(action)) {
  console.error(`Unknown action "${action}". Use add, reset or clear.`)
  process.exit(1)
}
const url = `http://localhost:${process.env.PORT ?? 5173}/?seed=${action}`
const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
try {
  execFileSync(opener, [url], { stdio: 'ignore', shell: process.platform === 'win32' })
  console.log(`Opened ${url}`)
} catch {
  console.log(`Open this in your browser: ${url}`)
}
