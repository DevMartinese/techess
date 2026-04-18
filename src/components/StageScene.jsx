import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, PerspectiveCamera, useGLTF } from '@react-three/drei'
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

function PieceController({ stage, piece, idx, centerIdx, selected, color, formControls }) {
  const groupRef = useRef(null)
  const innerRef = useRef(null)
  // tracks the piece's current ring angle so we can lerp along the shortest arc
  const angleRef = useRef(((idx - centerIdx) / PIECES.length) * TWO_PI)

  useFrame((_, delta) => {
    const g = groupRef.current
    if (!g) return
    // frame-rate independent damping. lower lambda = slower, smoother easing.
    const damp = (cur, tgt, lambda) =>
      THREE.MathUtils.damp(cur, tgt, lambda, delta)
    const RING_LAMBDA = 2.5
    const STAGE_LAMBDA = 4

    if (stage === 'intro' || stage === 'selecting') {
      // circular orbit around Y. shortest-path angular interpolation
      // makes sure pieces travel along the ring, not across it.
      const len = PIECES.length
      const targetAngle = ((idx - centerIdx) / len) * TWO_PI
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

    // form / board: damp toward absolute world target
    const target = stage === 'form'
      ? formTarget(piece, selected, formControls)
      : boardTarget(piece, selected, color)

    g.position.x = damp(g.position.x, target.position[0], STAGE_LAMBDA)
    g.position.y = damp(g.position.y, target.position[1], STAGE_LAMBDA)
    g.position.z = damp(g.position.z, target.position[2], STAGE_LAMBDA)

    const targetScale = target.visible ? target.scale : 0.001
    g.scale.setScalar(damp(g.scale.x, targetScale, STAGE_LAMBDA))

    g.rotation.x = damp(g.rotation.x, target.rotation[0], STAGE_LAMBDA)
    g.rotation.y = damp(g.rotation.y, target.rotation[1], STAGE_LAMBDA)
    g.rotation.z = damp(g.rotation.z, target.rotation[2], STAGE_LAMBDA)

    if (innerRef.current) {
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

function CameraRig({ stage, color }) {
  const camRef = useRef(null)
  const prevStageRef = useRef(stage)
  useFrame(() => {
    const cam = camRef.current
    if (!cam) return
    let target = [0, 0.4, 6]
    let look = [0, 0, 0]
    if (stage === 'form') {
      target = [0.5, 0, 6]
      look = [-0.5, -0.5, 0]
    } else if (stage === 'board') {
      // Frame the board from the side of the chosen color so the player's
      // army is in the foreground. Flipping z mirrors the view 180° around Y.
      const sideZ = color === 'black' ? -7.8 : 7.8
      target = [0, 5.2, sideZ]
      look = [0, -0.4, 0]
    }
    // On stage entry into 'board', snap directly to the target. Otherwise
    // lerping z from +6 (form) to -7.8 (black side) crosses the origin and
    // the camera visibly swings 180° around the lookAt point.
    if (prevStageRef.current !== 'board' && stage === 'board') {
      cam.position.set(target[0], target[1], target[2])
    } else {
      cam.position.x = THREE.MathUtils.lerp(cam.position.x, target[0], 0.05)
      cam.position.y = THREE.MathUtils.lerp(cam.position.y, target[1], 0.05)
      cam.position.z = THREE.MathUtils.lerp(cam.position.z, target[2], 0.05)
    }
    prevStageRef.current = stage
    cam.lookAt(look[0], look[1], look[2])
  })
  return <PerspectiveCamera ref={camRef} makeDefault position={[0, 0.4, 6]} fov={38} />
}

export default function StageScene({ stage, centerIdx, selected, color, formControls }) {
  return (
    <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
      <CameraRig stage={stage} color={color} />
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
