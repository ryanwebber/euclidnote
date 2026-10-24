import { SAMPLES, demoName, storageKey } from '../demo'
import { kv } from '../storage'

// A thin strip, only on the /demo route, to switch sample notes or reset the current one.
export function DemoBar() {
  const current = demoName()
  return (
    <div className="demo-bar" data-testid="demo-bar">
      <span>DEMO</span>
      <select
        aria-label="Sample note"
        value={current}
        onChange={(e) => {
          location.href = `${location.pathname}?note=${e.target.value}`
        }}
      >
        {Object.keys(SAMPLES).sort().map((name) => (
          <option key={name}>{name}</option>
        ))}
      </select>
      <button
        onClick={async () => {
          kv.remove(storageKey())
          await kv.flush()
          location.reload()
        }}
      >
        Reset
      </button>
    </div>
  )
}
