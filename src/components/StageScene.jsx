import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, PerspectiveCamera, useGLTF } from '@react-three/drei'
import { useSpring } from '@react-spring/three'
import * as THREE from 'three'
import ChessPiece from './ChessPiece'

const PIECES = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn']

const BOARD_SIZE = 8
const TILE = 0.7
const BOARD_Y = -0.5

const STARTING_ROW = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook']

// White army occupies the rows closest to the camera; black mirrors it.
const BACK_ROW = 7
const PAWN_ROW = 6
const BLACK_BACK_ROW = BOARD_SIZE - 1 - BACK_ROW // 0
const BLACK_PAWN_ROW = BOARD_SIZE - 1 - PAWN_ROW // 1

// Where the chosen piece lands on its side. Non-unique pieces (rook, knight,
// bishop, pawn) pick one canonical column so the rest of the army can fill
// the remaining slots.
const CHOSEN_COL = {
  rook: 0,
  knight: 1,
  bishop: 2,
  queen: 3,
  king: 4,
  pawn: 4,
}

function chosenBoardSlot(variant, color) {
  const col = CHOSEN_COL[variant] ?? 0
  const row =
    variant === 'pawn'
      ? color === 'black'
        ? BLACK_PAWN_ROW
        : PAWN_ROW
      : color === 'black'
        ? BLACK_BACK_ROW
        : BACK_ROW
  return { variant, col, row, color, id: `${color[0]}-${variant}-${col}` }
}

function allBoardSlots() {
  const list = []
  STARTING_ROW.forEach((v, col) => {
    list.push({ id: `w-${v}-${col}`, color: 'white', variant: v, col, row: BACK_ROW })
    list.push({ id: `b-${v}-${col}`, color: 'black', variant: v, col, row: BLACK_BACK_ROW })
  })
  for (let col = 0; col < 8; col++) {
    list.push({ id: `w-pawn-${col}`, color: 'white', variant: 'pawn', col, row: PAWN_ROW })
    list.push({ id: `b-pawn-${col}`, color: 'black', variant: 'pawn', col, row: BLACK_PAWN_ROW })
  }
  return list
}

// Per-variant board scale: respects chess hierarchy (king tallest, pawn smallest).
const BOARD_BASE = 0.34
const BOARD_PIECE_SCALES = {
  king: 1.0,
  queen: 0.94,
  rook: 0.78,
  bishop: 0.8,
  knight: 0.74,
  pawn: 0.62,
}
const boardScaleFor = (v) => BOARD_BASE * (BOARD_PIECE_SCALES[v] ?? 0.8)

const CAROUSEL_RADIUS = 2.4
// Scale of the front-of-ring piece (0.32 + 0.5 · depth(1)). Reused by single-mode
// so the lone piece keeps the exact visual size of the centered carousel piece.
const CAROUSEL_FRONT_SCALE = 0.82
// Single mode places the camera inside the ring (~2.4 away from the front
// piece instead of ~6). Scale + y offset keep the piece in the upper-middle
// of the viewport so it doesn't cover the BLANCAS/NEGRAS + ELEGIR UI row.
const SINGLE_MODE_SCALE = 0.4
const SINGLE_MODE_Y = 0.5

// Per-variant correction applied on top of the GUI scale, so we can normalize
// the visual size of pieces whose GLTFs render too big at the shared value.
const FORM_SCALE_FACTOR = {
  rook: 0.7,
}

function formTarget(piece, selected, controls) {
  if (piece === selected) {
    const factor = FORM_SCALE_FACTOR[piece] ?? 1
    return {
      position: [controls.x, controls.y, controls.z],
      scale: controls.scale * factor,
      rotation: [controls.rx, controls.ry, controls.rz],
      visible: true,
      spinAxis: 'y',
      spinSpeed: controls.spinSpeed,
    }
  }
  return {
    position: [0, -10, 0],
    scale: 0.01,
    rotation: [0, 0, 0],
    visible: false,
    spinAxis: 'none',
  }
}

// y of the top surface of the board base + tiles, where pieces should rest.
const BOARD_TOP = BOARD_Y + 0.001

const HIDDEN_TARGET = {
  position: [0, -10, 0],
  scale: 0.001,
  rotation: [0, 0, 0],
  visible: false,
  spinAxis: 'none',
}

function boardFacingY(color, variant) {
  if (variant === 'knight') return color === 'black' ? Math.PI * 0.25 : Math.PI * 0.75
  return color === 'black' ? 0 : Math.PI
}

// In the board stage only the chosen piece (from the carousel) animates into
// place. Everyone else is rendered statically by <BoardArmy>.
function boardTarget(piece, selected, color) {
  if (piece !== selected) return HIDDEN_TARGET
  const slot = chosenBoardSlot(piece, color)
  return {
    position: [(slot.col - 3.5) * TILE, BOARD_TOP, (slot.row - 3.5) * TILE],
    scale: boardScaleFor(piece),
    rotation: [0, boardFacingY(color, piece), 0],
    visible: true,
    spinAxis: 'none',
  }
}

const tmpVec = new THREE.Vector3()
const TWO_PI = Math.PI * 2

function shortestAngleDelta(target, current) {
  let diff = (target - current) % TWO_PI
  if (diff > Math.PI) diff -= TWO_PI
  if (diff < -Math.PI) diff += TWO_PI
  return diff
}

function PieceController({ stage, piece, idx, centerIdx, selected, color, formControls, selectionMode, transitionConfig }) {
  const groupRef = useRef(null)
  const innerRef = useRef(null)
  // tracks the piece's current ring angle so we can lerp along the shortest arc
  const angleRef = useRef(((idx - centerIdx) / PIECES.length) * TWO_PI)
  // read latest mode from inside useFrame without re-subscribing
  const modeRef = useRef(selectionMode)
  modeRef.current = selectionMode
  const prevStageRef = useRef(stage)

  // Spring for the form/board pose. Triggered imperatively via api.start whenever
  // the stage target changes; the useFrame loop reads its values each tick to
  // drive the same groupRef — only while stage is form/board.
  const [pose, poseApi] = useSpring(() => ({
    px: 0, py: 0, pz: 0,
    sx: 0.001,
    rx: 0, ry: 0, rz: 0,
    config: transitionConfig,
  }))

  // useLayoutEffect runs synchronously before paint, which beats r3f's
  // rAF-driven useFrame. That matters here: without it, useFrame reads the
  // spring's initial (0,0,0, scale 0.001) on the first frame of stage='form'
  // and the piece briefly snaps to the origin invisible before the spring is
  // seeded — that's the visible "salto" when pressing ELEGIR.
  useLayoutEffect(() => {
    if (stage !== 'form' && stage !== 'board') {
      prevStageRef.current = stage
      return
    }
    const isSelected = piece === selected
    // Non-selected pieces hide instantly — only the chosen one gets the spring
    // animation, so choosing doesn't splash 5 other pieces across the screen.
    if (!isSelected) {
      poseApi.set({ px: 0, py: -10, pz: 0, sx: 0.001, rx: 0, ry: 0, rz: 0 })
      prevStageRef.current = stage
      return
    }
    const g = groupRef.current
    const enteringFromRing =
      g &&
      prevStageRef.current !== 'form' &&
      prevStageRef.current !== 'board'
    if (enteringFromRing) {
      // seed the spring with the piece's current ring transform so the
      // selecting→form animation starts from where the ring left it
      poseApi.set({
        px: g.position.x, py: g.position.y, pz: g.position.z,
        sx: g.scale.x,
        rx: g.rotation.x, ry: g.rotation.y, rz: g.rotation.z,
      })
    }
    const t = stage === 'form'
      ? formTarget(piece, selected, formControls)
      : boardTarget(piece, selected, color)
    const s = t.visible ? t.scale : 0.001
    poseApi.start({
      px: t.position[0], py: t.position[1], pz: t.position[2],
      sx: s,
      rx: t.rotation[0], ry: t.rotation[1], rz: t.rotation[2],
      config: transitionConfig,
    })
    prevStageRef.current = stage
  }, [stage, selected, color, formControls, piece, transitionConfig, poseApi])

  useFrame((_, delta) => {
    const g = groupRef.current
    if (!g) return
    // frame-rate independent damping. lower lambda = slower, smoother easing.
    const damp = (cur, tgt, lambda) =>
      THREE.MathUtils.damp(cur, tgt, lambda, delta)
    const RING_LAMBDA = 2.5
    const STAGE_LAMBDA = 4

    if (stage === 'intro' || stage === 'selecting') {
      const len = PIECES.length
      const targetAngle = ((idx - centerIdx) / len) * TWO_PI

      if (modeRef.current === 'single') {
        // Camera sits at the ring center (see CameraRig) — pieces orbit AROUND
        // the viewer on a proper circle, so turning brings the next piece in
        // from the side while the current one swings out of view. Visibility
        // mask keeps only the front-facing piece rendered.
        const diff = shortestAngleDelta(targetAngle, angleRef.current)
        angleRef.current += diff * (1 - Math.exp(-RING_LAMBDA * delta))
        const a = angleRef.current
        g.position.x = Math.sin(a) * CAROUSEL_RADIUS
        g.position.y = damp(g.position.y, SINGLE_MODE_Y, RING_LAMBDA)
        g.position.z = -Math.cos(a) * CAROUSEL_RADIUS
        g.rotation.x = damp(g.rotation.x, 0, RING_LAMBDA)
        g.rotation.z = damp(g.rotation.z, 0, RING_LAMBDA)
        g.rotation.y = -a

        // constant scale: adjacent pieces are ≥60° off-axis, outside the
        // camera FOV, so they hide themselves by rotating out — no scale fade
        // needed (scaling was making the incoming piece grow/pop visibly).
        g.scale.setScalar(damp(g.scale.x, SINGLE_MODE_SCALE, RING_LAMBDA))

        const isCenter = Math.abs(shortestAngleDelta(0, targetAngle)) < 0.01
        if (innerRef.current) {
          if (isCenter) {
            // wrap into [-π, π] so when this piece stops being center the
            // damp-to-0 takes the shortest arc (otherwise the accumulated
            // angle unwinds visibly as a fast spin).
            let ry = innerRef.current.rotation.y + delta * 0.8
            if (ry > Math.PI) ry -= Math.PI * 2
            else if (ry < -Math.PI) ry += Math.PI * 2
            innerRef.current.rotation.y = ry
          } else {
            innerRef.current.rotation.y = damp(innerRef.current.rotation.y, 0, RING_LAMBDA)
          }
        }
        return
      }

      // circular orbit around Y. shortest-path angular interpolation
      // makes sure pieces travel along the ring, not across it.
      const diff = shortestAngleDelta(targetAngle, angleRef.current)
      // exponential easing on the angle delta — equivalent to damp() but on a relative value
      angleRef.current += diff * (1 - Math.exp(-RING_LAMBDA * delta))
      const a = angleRef.current
      g.position.x = Math.sin(a) * CAROUSEL_RADIUS
      g.position.y = damp(g.position.y, 0, RING_LAMBDA)
      g.position.z = (Math.cos(a) - 1) * CAROUSEL_RADIUS * 0.6
      g.rotation.x = damp(g.rotation.x, 0, RING_LAMBDA)
      g.rotation.z = damp(g.rotation.z, 0, RING_LAMBDA)
      g.rotation.y = -a

      const depth = (Math.cos(a) + 1) / 2 // 1 at front, 0 at back
      const ts = 0.32 + depth * 0.5
      g.scale.setScalar(damp(g.scale.x, ts, RING_LAMBDA))

      const isCenter = Math.abs(shortestAngleDelta(0, targetAngle)) < 0.01
      if (innerRef.current) {
        if (isCenter) innerRef.current.rotation.y += delta * 0.8
        else innerRef.current.rotation.y = damp(innerRef.current.rotation.y, 0, RING_LAMBDA)
      }
      return
    }

    // form / board: position/scale/rotation come from the spring driven by the
    // stage effect above; spin stays continuous (not a transition).
    g.position.set(pose.px.get(), pose.py.get(), pose.pz.get())
    g.scale.setScalar(pose.sx.get())
    g.rotation.set(pose.rx.get(), pose.ry.get(), pose.rz.get())

    if (innerRef.current) {
      const target = stage === 'form'
        ? formTarget(piece, selected, formControls)
        : boardTarget(piece, selected, color)
      const speed = target.spinSpeed ?? 0.6
      if (target.spinAxis === 'y') innerRef.current.rotation.y += delta * speed
      else innerRef.current.rotation.y = damp(innerRef.current.rotation.y, 0, STAGE_LAMBDA)
    }
  })

  return (
    <group ref={groupRef} position={[0, 0, 0]} scale={0.001}>
      <group ref={innerRef}>
        <ChessPiece
          variant={piece}
          spinSpeed={0}
          bottomAlign={stage === 'board'}
          dark={color === 'black'}
        />
      </group>
    </group>
  )
}

function ChessBoard({ visible }) {
  const tiles = useMemo(() => {
    const arr = []
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const dark = (r + c) % 2 === 1
        arr.push({ r, c, dark, key: `${r}-${c}` })
      }
    }
    return arr
  }, [])

  const groupRef = useRef(null)
  useFrame(() => {
    if (!groupRef.current) return
    const target = visible ? 1 : 0
    const cur = groupRef.current.scale.x
    const ns = THREE.MathUtils.lerp(cur, target, 0.08)
    groupRef.current.scale.setScalar(ns)
    groupRef.current.position.y = THREE.MathUtils.lerp(
      groupRef.current.position.y,
      visible ? 0 : -2,
      0.08,
    )
  })

  return (
    <group ref={groupRef} scale={0.001} position={[0, -2, 0]}>
      {tiles.map((t) => (
        <mesh
          key={t.key}
          position={[(t.c - 3.5) * TILE, BOARD_Y, (t.r - 3.5) * TILE]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[TILE, TILE]} />
          {/* unlit material guarantees the dark/light contrast survives the
              studio environment and directional light. */}
          <meshBasicMaterial color={t.dark ? '#1a1411' : '#ece2cc'} />
        </mesh>
      ))}
      <mesh position={[0, BOARD_Y - 0.06, 0]} receiveShadow>
        <boxGeometry args={[BOARD_SIZE * TILE + 0.4, 0.1, BOARD_SIZE * TILE + 0.4]} />
        <meshStandardMaterial color="#0a0807" roughness={0.7} />
      </mesh>
    </group>
  )
}

// Renders all 32 board pieces statically (no fall animation). The slot of the
// chosen piece is skipped — that one is animated separately by PieceController
// from the form position to the board.
function BoardArmy({ stage, selected, color }) {
  const slots = useMemo(() => allBoardSlots(), [])
  const skipId = selected ? chosenBoardSlot(selected, color).id : null
  const visible = stage === 'board'
  return (
    <>
      {slots
        .filter((s) => s.id !== skipId)
        .map((s) => (
          <BoardPiece key={s.id} slot={s} visible={visible} />
        ))}
    </>
  )
}

function BoardPiece({ slot, visible }) {
  const fullScale = boardScaleFor(slot.variant)
  // Snap to position the moment the board stage activates; no flying-in.
  const scale = visible ? fullScale : 0.001
  return (
    <group
      position={[(slot.col - 3.5) * TILE, BOARD_TOP, (slot.row - 3.5) * TILE]}
      rotation={[0, boardFacingY(slot.color, slot.variant), 0]}
      scale={scale}
    >
      <ChessPiece
        variant={slot.variant}
        spinSpeed={0}
        bottomAlign
        dark={slot.color === 'black'}
      />
    </group>
  )
}

function resolveCameraTarget(stage, color, selectionMode) {
  if ((stage === 'intro' || stage === 'selecting') && selectionMode === 'single') {
    return { target: [0, 0.4, 0], look: [0, SINGLE_MODE_Y, -CAROUSEL_RADIUS] }
  }
  if (stage === 'form') return { target: [0.5, 0, 6], look: [-0.5, -0.5, 0] }
  if (stage === 'board') {
    // Frame the board from the side of the chosen color so the player's
    // army is in the foreground. Flipping z mirrors the view 180° around Y.
    const sideZ = color === 'black' ? -7.8 : 7.8
    return { target: [0, 5.2, sideZ], look: [0, -0.4, 0] }
  }
  return { target: [0, 0.4, 6], look: [0, 0, 0] }
}

function CameraRig({ stage, color, selectionMode, transitionConfig }) {
  const camRef = useRef(null)
  const prevStageRef = useRef(stage)

  // Spring is ONLY used when transitioning into/within form or board. During
  // boot/intro/selecting the camera keeps the original per-frame lerp so the
  // ring / single-mode positioning behave exactly as before.
  const [cam, camApi] = useSpring(() => ({
    cx: 0, cy: 0.4, cz: 6,
    config: transitionConfig,
  }))

  // Same reason as PieceController: seed the spring synchronously before paint
  // so useFrame's first frame under form/board doesn't read the spring's
  // initial (0, 0.4, 6) and jerk the camera there before animating.
  useLayoutEffect(() => {
    if (stage !== 'form' && stage !== 'board') {
      prevStageRef.current = stage
      return
    }
    const c = camRef.current
    const enteringFromRing =
      c &&
      prevStageRef.current !== 'form' &&
      prevStageRef.current !== 'board'
    if (enteringFromRing) {
      // seed spring with the camera's actual current position so the form
      // animation starts from wherever selecting left it (inside the ring
      // in single mode, outside in carousel mode)
      camApi.set({ cx: c.position.x, cy: c.position.y, cz: c.position.z })
    }
    const { target } = resolveCameraTarget(stage, color, selectionMode)
    // Board entry snaps: lerping z across the origin (+6 → -7.8 for black)
    // would visibly swing the camera 180° around the lookAt point.
    const snap = stage === 'board' && prevStageRef.current !== 'board'
    camApi.start({
      cx: target[0], cy: target[1], cz: target[2],
      config: transitionConfig,
      immediate: snap,
    })
    prevStageRef.current = stage
  }, [stage, color, selectionMode, transitionConfig, camApi])

  useFrame(() => {
    const c = camRef.current
    if (!c) return
    const { target, look } = resolveCameraTarget(stage, color, selectionMode)
    if (stage === 'form' || stage === 'board') {
      c.position.set(cam.cx.get(), cam.cy.get(), cam.cz.get())
    } else {
      c.position.x = THREE.MathUtils.lerp(c.position.x, target[0], 0.05)
      c.position.y = THREE.MathUtils.lerp(c.position.y, target[1], 0.05)
      c.position.z = THREE.MathUtils.lerp(c.position.z, target[2], 0.05)
    }
    c.lookAt(look[0], look[1], look[2])
  })

  return <PerspectiveCamera ref={camRef} makeDefault position={[0, 0.4, 6]} fov={38} />
}

export default function StageScene({ stage, centerIdx, selected, color, formControls, selectionMode, transitionConfig }) {
  return (
    <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
      <CameraRig
        stage={stage}
        color={color}
        selectionMode={selectionMode}
        transitionConfig={transitionConfig}
      />
      <ambientLight intensity={0.45} />
      <directionalLight
        position={[4, 6, 3]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <Environment preset="studio" />
      <Suspense fallback={null}>
        {PIECES.map((piece, idx) => (
          <PieceController
            key={piece}
            stage={stage}
            piece={piece}
            idx={idx}
            centerIdx={centerIdx}
            selected={selected}
            color={color}
            formControls={formControls}
            selectionMode={selectionMode}
            transitionConfig={transitionConfig}
          />
        ))}
        <BoardArmy stage={stage} selected={selected} color={color} />
        <ChessBoard visible={stage === 'board'} />
      </Suspense>
    </Canvas>
  )
}

PIECES.forEach((p) => {
  // ensure preload of all GLTFs used in board
  const url = `/${p === 'knight' ? 'knight_-_low_poly' : p === 'queen' ? 'queen_-_low_poly' : `low_poly_${p}`}/scene.gltf`
  useGLTF.preload(url)
})
