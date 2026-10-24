import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { initLibrary } from './library'
import { initSettings } from './settings'
import { openStorage } from './storage'
import { initStore } from './store'
import './styles.css'

// Notes are loaded from the database before anything is drawn, so every read after this is instant.
async function boot() {
  initSettings()
  await openStorage()
  // Development only: fill the library with the examples. The condition is a build-time constant, so a
  // production build contains neither this call nor the file it loads.
  if (import.meta.env.DEV) (await import('./devseed')).applyDevSeed()
  initStore()
  initLibrary()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
void boot()

// Work offline once the app has been opened. Only real (secure) origins can; tests and the dev server skip it.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => undefined))
}
