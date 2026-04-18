import { useEffect, useState } from 'react'
import { addDevFolder, isDevGuiEnabled } from './internal/devGui'

const LS_KEY = 'techess:selection-controls'

const DEFAULTS = {
  mode: 'carousel',
}

const MODES = ['carousel', 'single']


function load() {
  if (typeof window === 'undefined') return { ...DEFAULTS }
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw)
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

function save(state) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(state))
  } catch {
    /* ignore quota errors */
  }
}

/**
 * Dev-only lil-gui panel for toggling the selection stage between the default
 * carousel (all pieces orbiting) and a minimal single-piece mode. In
 * production the GUI is skipped and the canonical default is returned, so
 * lil-gui never ships in the prod bundle.
 */
export default function useSelectionControls(active) {
  const [values, setValues] = useState(() => (isDevGuiEnabled() ? load() : { ...DEFAULTS }))

  useEffect(() => {
    if (!isDevGuiEnabled() || !active) return
    let folder = null
    let cancelled = false

    addDevFolder('Modo de selección').then((f) => {
      if (cancelled) {
        f.destroy()
        return
      }
      folder = f
      const state = { ...values }

      const update = (key) => (v) => {
        state[key] = v
        setValues((prev) => {
          const next = { ...prev, [key]: v }
          save(next)
          return next
        })
      }

      folder.add(state, 'mode', MODES).name('modo').onChange(update('mode'))

      folder
        .add(
          {
            reset: () => {
              window.localStorage.removeItem(LS_KEY)
              setValues({ ...DEFAULTS })
              folder.controllersRecursive().forEach((c) => {
                if (c.property in DEFAULTS) c.setValue(DEFAULTS[c.property])
              })
            },
          },
          'reset',
        )
        .name('↺ Reset')
    })

    return () => {
      cancelled = true
      folder?.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return values
}
