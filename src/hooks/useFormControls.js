import { useEffect, useState } from 'react'
import GUI from 'lil-gui'

const LS_KEY = 'techess:form-controls'

const DEFAULTS = {
  x: -3.4,
  y: -1.4,
  z: 1.5,
  scale: 2,
  rx: 0,
  ry: 0.4,
  rz: 0,
  spinSpeed: 0.35,
}

function load() {
  if (typeof window === 'undefined') return DEFAULTS
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
 * selected piece during the form stage. Values persist in localStorage.
 */
export default function useFormControls(active) {
  const [values, setValues] = useState(load)

  useEffect(() => {
    if (!active) return
    const gui = new GUI({ title: 'Pieza seleccionada' })
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
            // refresh the gui controllers so the sliders reflect defaults
            gui.controllersRecursive().forEach((c) => {
              if (c.property in DEFAULTS) c.setValue(DEFAULTS[c.property])
            })
          },
        },
        'reset',
      )
      .name('↺ Reset')

    return () => gui.destroy()
    // intentionally only re-run when `active` flips so we don't recreate the
    // panel on every value tweak
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return values
}
