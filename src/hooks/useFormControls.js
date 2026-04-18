import { useEffect, useState } from 'react'

const LS_KEY = 'techess:form-controls'

// Canonical pose for the selected piece during the form stage. Used as the
// production value (no GUI) and as the starting point for the dev tuner.
const DEFAULTS = {
  x: -4.2,
  y: -1.9,
  z: -1.4,
  scale: 3.15,
  rx: 0,
  ry: 0.284,
  rz: -0.5615,
  spinSpeed: 0.4,
}

const IS_DEV = import.meta.env.DEV

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
 * Mounts a lil-gui panel while `active` is true and exposes tunables for the
 * selected piece during the form stage. Production builds skip the GUI and
 * always return the canonical defaults — the panel and lil-gui itself are
 * dynamically imported so they don't ship in the prod bundle.
 */
export default function useFormControls(active) {
  const [values, setValues] = useState(() => (IS_DEV ? load() : { ...DEFAULTS }))

  useEffect(() => {
    if (!IS_DEV || !active) return
    let gui = null
    let cancelled = false

    import('lil-gui').then(({ default: GUI }) => {
      if (cancelled) return
      gui = new GUI({ title: 'Pieza seleccionada' })
      const state = { ...values }

      const update = (key) => (v) => {
        state[key] = v
        setValues((prev) => {
          const next = { ...prev, [key]: v }
          save(next)
          return next
        })
      }

      gui.add(state, 'x', -6, 6, 0.05).onChange(update('x'))
      gui.add(state, 'y', -4, 4, 0.05).onChange(update('y'))
      gui.add(state, 'z', -4, 4, 0.05).onChange(update('z'))
      gui.add(state, 'scale', 0.2, 4, 0.05).onChange(update('scale'))
      gui.add(state, 'rx', -Math.PI, Math.PI, 0.01).name('rot x').onChange(update('rx'))
      gui.add(state, 'ry', -Math.PI, Math.PI, 0.01).name('rot y').onChange(update('ry'))
      gui.add(state, 'rz', -Math.PI, Math.PI, 0.01).name('rot z').onChange(update('rz'))
      gui.add(state, 'spinSpeed', 0, 2, 0.01).name('spin').onChange(update('spinSpeed'))

      gui
        .add(
          {
            reset: () => {
              window.localStorage.removeItem(LS_KEY)
              setValues({ ...DEFAULTS })
              gui.controllersRecursive().forEach((c) => {
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
      gui?.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return values
}
