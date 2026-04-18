import { useEffect, useState } from 'react'
import GUI from 'lil-gui'

const VARIANTS = [
  'capsule',
  'sphere',
  'box',
  'pawn',
  'knight',
  'bishop',
  'rook',
  'queen',
  'king',
]
const EFFECTS = ['none', 'ascii', 'etch', 'blend']
const LAYOUTS = ['single', 'scattered']

const SCATTERED_DEFAULTS = {
  king: { x: -1.13, y: 1.27, z: -0.4, scale: 0.55, rx: 0, ry: 0.2, rz: 0.12 },
  queen: { x: 1.5, y: 1.5, z: 0.2, scale: 0.5, rx: 0.04, ry: -0.3, rz: -0.18 },
  rook: { x: -1.4, y: -1.07, z: 0.5, scale: 0.32, rx: 0.06, ry: 0.1, rz: 0.15 },
  bishop: {
    x: 1.9,
    y: -0.5,
    z: -0.3,
    scale: 0.49,
    rx: -0.04,
    ry: -0.15,
    rz: -0.22,
  },
  knight: { x: 0.3, y: 0.2, z: 0.6, scale: 0.4, rx: 0, ry: 0.25, rz: 0.1 },
  pawn: { x: 0.1, y: -1.5, z: -0.2, scale: 0.36, rx: 0, ry: -0.4, rz: -0.14 },
}

const LS_KEY = 'chess-explorations:scattered'
const clone = (obj) => JSON.parse(JSON.stringify(obj))

function loadScattered() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const merged = clone(SCATTERED_DEFAULTS)
    for (const piece of Object.keys(SCATTERED_DEFAULTS)) {
      if (parsed[piece]) {
        for (const key of Object.keys(SCATTERED_DEFAULTS[piece])) {
          if (typeof parsed[piece][key] === 'number') {
            merged[piece][key] = parsed[piece][key]
          }
        }
      }
    }
    return merged
  } catch {
    return null
  }
}

function saveScattered(state) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(state))
  } catch {
    /* quota/private-mode */
  }
}

export default function usePieceControls({
  variant: initialVariant = 'capsule',
  effect: initialEffect = 'none',
  layout: initialLayout = 'single',
} = {}) {
  const [variant, setVariant] = useState(initialVariant)
  const [effect, setEffect] = useState(initialEffect)
  const [layout, setLayout] = useState(initialLayout)
  const [scattered, setScattered] = useState(
    () => loadScattered() ?? clone(SCATTERED_DEFAULTS),
  )

  useEffect(() => {
    saveScattered(scattered)
  }, [scattered])

  useEffect(() => {
    const gui = new GUI({ title: 'Pieza' })
    const state = {
      layout: initialLayout,
      variant: initialVariant,
      effect: initialEffect,
    }
    gui
      .add(state, 'layout', LAYOUTS)
      .name('Layout')
      .onChange((v) => setLayout(v))
    gui
      .add(state, 'variant', VARIANTS)
      .name('Geometría')
      .onChange((v) => setVariant(v))
    gui
      .add(state, 'effect', EFFECTS)
      .name('Shader')
      .onChange((v) => setEffect(v))

    const scFolder = gui.addFolder('Scattered')
    scFolder.close()

    const initial = loadScattered() ?? clone(SCATTERED_DEFAULTS)
    const mutable = clone(initial)
    const updateOne = (piece, key) => (v) =>
      setScattered((prev) => ({
        ...prev,
        [piece]: { ...prev[piece], [key]: v },
      }))

    const controllers = []
    const TAU = Math.PI
    for (const piece of Object.keys(SCATTERED_DEFAULTS)) {
      const f = scFolder.addFolder(piece)
      const p = mutable[piece]
      controllers.push(
        f.add(p, 'x', -4, 4, 0.01).onChange(updateOne(piece, 'x')),
        f.add(p, 'y', -3, 3, 0.01).onChange(updateOne(piece, 'y')),
        f.add(p, 'z', -2, 2, 0.01).onChange(updateOne(piece, 'z')),
        f.add(p, 'scale', 0.1, 1.5, 0.01).onChange(updateOne(piece, 'scale')),
        f
          .add(p, 'rx', -TAU, TAU, 0.01)
          .name('rot x')
          .onChange(updateOne(piece, 'rx')),
        f
          .add(p, 'ry', -TAU, TAU, 0.01)
          .name('rot y')
          .onChange(updateOne(piece, 'ry')),
        f
          .add(p, 'rz', -TAU, TAU, 0.01)
          .name('rot z')
          .onChange(updateOne(piece, 'rz')),
      )
      f.close()
    }

    const actions = {
      reset: () => {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(LS_KEY)
        }
        const fresh = clone(SCATTERED_DEFAULTS)
        setScattered(fresh)
        controllers.forEach((c) => {
          const pieceName = c.parent._title
          const key = c.property
          if (fresh[pieceName] && key in fresh[pieceName]) {
            c.setValue(fresh[pieceName][key])
          }
        })
      },
    }
    scFolder.add(actions, 'reset').name('↺ Reset positions')

    return () => gui.destroy()
  }, [initialVariant, initialEffect, initialLayout])

  return { variant, effect, layout, scattered }
}
