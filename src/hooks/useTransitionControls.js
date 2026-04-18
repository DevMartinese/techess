import { useEffect, useMemo, useState } from 'react'
import { config as springConfig, easings } from '@react-spring/three'
import { addDevFolder, isDevGuiEnabled } from './internal/devGui'

const LS_KEY = 'techess:transition-controls'

// Duration-based presets feel more predictable/elegant than spring physics for
// UI transitions — no micro-oscillation at the end, just a clean decel curve.
const DURATION_PRESETS = {
  suave: { duration: 2200, easing: easings.easeOutCubic },
  'smooth-slow': { duration: 1600, easing: easings.easeOutCubic },
  smooth: { duration: 1200, easing: easings.easeOutCubic },
  'smooth-fast': { duration: 800, easing: easings.easeOutCubic },
  cinematic: { duration: 1400, easing: easings.easeOutQuart },
}

const PRESETS = [
  'suave',
  'smooth-slow',
  'smooth',
  'smooth-fast',
  'cinematic',
  'default',
  'gentle',
  'wobbly',
  'stiff',
  'slow',
  'molasses',
]

const DEFAULTS = {
  preset: 'suave',
}


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
 * Dev-only lil-gui panel for switching between @react-spring/three presets that
 * drive the selected-piece + camera transitions into the form and board stages.
 * In production the GUI is skipped and a canonical preset is returned, so
 * lil-gui never ships in the prod bundle.
 */
export default function useTransitionControls(active) {
  const [values, setValues] = useState(() => (isDevGuiEnabled() ? load() : { ...DEFAULTS }))

  useEffect(() => {
    if (!isDevGuiEnabled() || !active) return
    let folder = null
    let cancelled = false

    addDevFolder('Transiciones').then((f) => {
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

      folder.add(state, 'preset', PRESETS).name('preset').onChange(update('preset'))

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

  return useMemo(() => {
    if (values.preset in DURATION_PRESETS) return DURATION_PRESETS[values.preset]
    return springConfig[values.preset] ?? DURATION_PRESETS.suave
  }, [values.preset])
}
