import { useEffect, useRef, useState } from 'react'
import { useInstallPrompt } from '../hooks'
import { BackupError, THEMES, type Theme, formatBytes } from '../model/settings'
import { deleteAllNotes, exportAll, importBackup, useLibrary } from '../library'
import { kv } from '../storage'
import { openSettings, setHaptics, setTheme, useSettings } from '../settings'
import { XIcon } from './icons'

const THEME_LABELS: Record<Theme, string> = { system: 'Auto', light: 'Light', dark: 'Dark' }

// What the browser says about storage and offline use.
function useDeviceFacts() {
  const [facts, setFacts] = useState<{ persisted: boolean | null; used: number | null; offline: 'ready' | 'later' | 'unavailable'; installed: boolean }>({
    persisted: null,
    used: null,
    offline: 'unavailable',
    installed: false,
  })
  const refresh = async () => {
    const storage = navigator.storage
    const persisted = storage?.persisted ? await storage.persisted() : null
    const estimate = storage?.estimate ? await storage.estimate() : null
    const sw = 'serviceWorker' in navigator ? navigator.serviceWorker : null
    setFacts({
      persisted,
      used: estimate?.usage ?? null,
      offline: !sw ? 'unavailable' : sw.controller ? 'ready' : 'later',
      installed: matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true,
    })
  }
  useEffect(() => {
    void refresh()
  }, [])
  return { ...facts, refresh }
}

function Row({ label, hint, children }: { label: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="set-row">
      <div className="set-text">
        <strong>{label}</strong>
        {hint && <span>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

export function SettingsSheet() {
  const { open, theme, haptics } = useSettings()
  const noteCount = useLibrary((s) => s.entries.length)
  const facts = useDeviceFacts()
  const install = useInstallPrompt()
  const file = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [confirmWipe, setConfirmWipe] = useState(false)

  useEffect(() => {
    if (!open) return
    setMessage(null)
    void facts.refresh()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && (confirmWipe ? setConfirmWipe(false) : openSettings(false))
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [open, confirmWipe])

  if (!open) return null
  const close = () => openSettings(false)

  const download = () => {
    const blob = new Blob([exportAll()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `euclidnote-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMessage('Backup saved.')
  }
  const restore = async (f: File) => {
    try {
      const { added, skipped } = importBackup(await f.text())
      setMessage(`Added ${added} note${added === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} that could not be read` : ''}.`)
    } catch (e) {
      setMessage(e instanceof BackupError ? e.message : 'That file could not be read.')
    }
  }
  const protect = async () => {
    await navigator.storage?.persist?.()
    await facts.refresh()
  }
  const reload = async () => {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
    await reg?.update().catch(() => undefined)
    location.reload()
  }

  return (
    <div className="scrim sheet-scrim" data-testid="settings-scrim" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <section className="modal settings" role="dialog" aria-label="Settings" data-testid="settings">
        <header className="settings-head">
          <h2>Settings</h2>
          <button className="sheet-close" aria-label="Close settings" data-testid="settings-close" onClick={close}>
            <XIcon size={16} />
          </button>
        </header>

        <h3>Look and feel</h3>
        <Row label="Appearance" hint="Auto follows your device">
          <div className="seg" role="group" aria-label="Appearance">
            {THEMES.map((t) => (
              <button key={t} data-testid={`theme-${t}`} aria-pressed={theme === t} onClick={() => setTheme(t)}>
                {THEME_LABELS[t]}
              </button>
            ))}
          </div>
        </Row>
        <Row label="Haptics" hint="Small buzzes while dragging, where supported">
          <div className="seg" role="group" aria-label="Haptics">
            <button data-testid="haptics-on" aria-pressed={haptics} onClick={() => setHaptics(true)}>On</button>
            <button data-testid="haptics-off" aria-pressed={!haptics} onClick={() => setHaptics(false)}>Off</button>
          </div>
        </Row>

        <h3>Your notes</h3>
        <Row label="Stored on this device" hint={`${noteCount} note${noteCount === 1 ? '' : 's'}${facts.used !== null ? ` · ${formatBytes(facts.used)} used` : ''} · ${kv.kind === 'indexeddb' ? 'in the database' : 'in browser storage'}`} />
        {facts.persisted !== null && (
          <Row label="Protection" hint={facts.persisted ? 'The browser will not clear your notes to free up space' : 'The browser may clear them if the device runs low on space'}>
            {facts.persisted ? <span className="pill-ok" data-testid="persisted">Protected</span> : <button className="set-btn" data-testid="protect" onClick={protect}>Protect</button>}
          </Row>
        )}
        <Row label="Back up" hint="Save every note to one file">
          <button className="set-btn" data-testid="export" onClick={download}>Export</button>
        </Row>
        <Row label="Restore" hint="Add the notes from a backup file">
          <button className="set-btn" data-testid="import" onClick={() => file.current?.click()}>Import</button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            hidden
            data-testid="import-file"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void restore(f)
            }}
          />
        </Row>
        {message && <p className="set-message" role="status" data-testid="settings-message">{message}</p>}

        <h3>The app</h3>
        <Row
          label="Install"
          hint={facts.installed ? 'Running as an installed app' : install ? 'Add it to your home screen or dock' : 'In Safari: Share, then Add to Home Screen'}
        >
          {install && !facts.installed && (
            <button className="set-btn" data-testid="settings-install" onClick={install.install}>Install</button>
          )}
        </Row>
        <Row
          label="Works offline"
          hint={facts.offline === 'ready' ? 'Ready: it opens without a connection' : facts.offline === 'later' ? 'Open it once more while online to finish setting up' : 'Not available here (needs a secure connection)'}
        >
          <span className="pill-ok" data-testid="offline" data-state={facts.offline}>{facts.offline === 'ready' ? 'Ready' : facts.offline === 'later' ? 'Almost' : 'No'}</span>
        </Row>
        <Row label="Update" hint="Reload with the newest version">
          <button className="set-btn" data-testid="reload" onClick={reload}>Reload</button>
        </Row>
        <Row label="Version" hint={`v${__APP_VERSION__} · built ${__BUILD_DATE__}`} />

        <h3>Danger zone</h3>
        <Row label="Delete everything" hint="Remove every note from this device">
          <button className="set-btn danger" data-testid="wipe" disabled={noteCount === 0} onClick={() => setConfirmWipe(true)}>Delete all</button>
        </Row>
      </section>

      {confirmWipe && (
        <div className="scrim" data-testid="wipe-scrim" onPointerDown={(e) => e.target === e.currentTarget && setConfirmWipe(false)}>
          <div className="modal" role="alertdialog" aria-label="Delete all notes" data-testid="wipe-dialog">
            <h2>Delete all {noteCount} notes?</h2>
            <p>Every note on this device will be gone. Export a backup first if you might want them back.</p>
            <div className="modal-actions">
              <button data-testid="wipe-cancel" onClick={() => setConfirmWipe(false)}>Cancel</button>
              <button
                data-testid="wipe-confirm"
                data-danger="true"
                onClick={() => {
                  setConfirmWipe(false)
                  deleteAllNotes()
                  close()
                }}
              >
                Delete all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
