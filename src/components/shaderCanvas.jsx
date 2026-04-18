import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { WebGPURenderer, RenderPipeline } from 'three/webgpu'
import {
  Fn,
  pass,
  uv,
  vec2,
  vec3,
  vec4,
  float,
  texture as tslTexture,
  dot,
  max,
  mod,
  step,
  screenSize,
  time,
  mix,
  fract,
  abs,
  smoothstep,
} from 'three/tsl'

const CHARS = ' .:-+*=%@#/'
const CELL_SIZE = 8

function createCharAtlas() {
  const charW = 16
  const charH = 16
  const canvas = document.createElement('canvas')
  canvas.width = charW * CHARS.length
  canvas.height = charH
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#000000'
  ctx.font = `${Math.floor(charH * 0.95)}px monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < CHARS.length; i++) {
    ctx.fillText(CHARS[i], i * charW + charW / 2, charH / 2 + 1)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.minFilter = THREE.NearestFilter
  tex.magFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.colorSpace = THREE.NoColorSpace
  tex.needsUpdate = true
  return tex
}

function AsciiPostEffect({ atlas, effect, inkColor }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const pipeRef = useRef(null)
  const [ir, ig, ib] = inkColor

  useEffect(() => {
    const renderer = gl
    const pipe = new RenderPipeline(renderer)
    const scenePass = pass(scene, camera)
    const sceneColor = scenePass.getTextureNode('output')
    const lumaWeights = vec3(0.299, 0.587, 0.114)
    const ink = vec3(ir, ig, ib)

    const numChars = float(CHARS.length)
    const cellSize = float(CELL_SIZE)

    const asciiFn = Fn(() => {
      const res = screenSize
      const pixelPos = uv().mul(res)
      const cellCoord = pixelPos.div(cellSize).floor()
      const cellCenterUV = cellCoord.add(0.5).mul(cellSize).div(res)

      const o = cellSize.mul(0.3).div(res)
      const s0 = sceneColor.sample(cellCenterUV)
      const s1 = sceneColor.sample(cellCenterUV.add(vec2(o, 0)))
      const s2 = sceneColor.sample(cellCenterUV.sub(vec2(o, 0)))
      const s3 = sceneColor.sample(cellCenterUV.add(vec2(0, o)))
      const s4 = sceneColor.sample(cellCenterUV.sub(vec2(0, o)))
      const l0 = dot(s0.rgb, lumaWeights)
      const l1 = dot(s1.rgb, lumaWeights)
      const l2 = dot(s2.rgb, lumaWeights)
      const l3 = dot(s3.rgb, lumaWeights)
      const l4 = dot(s4.rgb, lumaWeights)
      const lumaMax = max(max(max(l0, l1), max(l2, l3)), l4)
      const alphaMax = max(max(max(s0.a, s1.a), max(s2.a, s3.a)), s4.a)
      const boosted = lumaMax.pow(0.55)
      const charIdx = boosted.mul(numChars).floor().clamp(0, numChars.sub(1))

      const localUV = pixelPos.sub(cellCoord.mul(cellSize)).div(cellSize)
      const atlasU = charIdx.add(localUV.x).div(numChars)
      const atlasV = float(1).sub(localUV.y)
      const charPixel = tslTexture(atlas, vec2(atlasU, atlasV))
      const inkStrength = float(1).sub(charPixel.r)
      return vec4(ink, inkStrength.mul(alphaMax))
    })

    const etchFn = Fn(() => {
      const res = screenSize
      const pixelPos = uv().mul(res)

      const o = float(1.5).div(res)
      const l0 = dot(sceneColor.sample(uv()).rgb, lumaWeights)
      const l1 = dot(sceneColor.sample(uv().add(vec2(o.x, 0))).rgb, lumaWeights)
      const l2 = dot(sceneColor.sample(uv().sub(vec2(o.x, 0))).rgb, lumaWeights)
      const l3 = dot(sceneColor.sample(uv().add(vec2(0, o.y))).rgb, lumaWeights)
      const l4 = dot(sceneColor.sample(uv().sub(vec2(0, o.y))).rgb, lumaWeights)
      const luma = max(max(max(l0, l1), max(l2, l3)), l4)

      const spacing = float(7)
      const thickness = float(1.2)
      const big = res.x

      const h1 = step(mod(pixelPos.x.add(pixelPos.y), spacing), thickness)
      const h2 = step(mod(pixelPos.x.sub(pixelPos.y).add(big), spacing), thickness)
      const h3 = step(
        mod(pixelPos.x.add(pixelPos.y).add(spacing.mul(0.5)), spacing),
        thickness,
      )
      const h4 = step(
        mod(pixelPos.x.sub(pixelPos.y).add(big).add(spacing.mul(0.5)), spacing),
        thickness,
      )

      const t1 = step(float(0.18), luma)
      const t2 = step(float(0.4), luma)
      const t3 = step(float(0.62), luma)
      const t4 = step(float(0.82), luma)

      const inkMask = max(
        max(h1.mul(t1), h2.mul(t2)),
        max(h3.mul(t3), h4.mul(t4)),
      )
      return vec4(ink, inkMask)
    })

    const blendFn = Fn(() => {
      const cycle = time.mul(0.12)
      const tri = abs(fract(cycle).mul(2).sub(1))
      const amt = smoothstep(float(0.35), float(0.65), tri)
      return mix(asciiFn(), etchFn(), amt)
    })

    pipe.outputNode =
      effect === 'blend' ? blendFn() : effect === 'ascii' ? asciiFn() : etchFn()
    pipeRef.current = pipe

    return () => {
      pipeRef.current = null
    }
  }, [gl, scene, camera, atlas, effect, ir, ig, ib])

  useFrame(() => {
    pipeRef.current?.render()
  }, 1)

  return null
}

export default function ShaderCanvas({
  effect,
  inkColor = [0, 0, 0],
  children,
}) {
  const atlas = useMemo(() => createCharAtlas(), [])
  return (
    <Canvas
      flat
      camera={{ position: [0, 0, 4.5], fov: 35 }}
      gl={async (props) => {
        const renderer = new WebGPURenderer({
          canvas: props.canvas,
          antialias: true,
          alpha: true,
        })
        await renderer.init()
        renderer.setClearColor(0x000000, 0)
        return renderer
      }}
    >
      <ambientLight intensity={0.6} />
      <pointLight position={[5, 5, 5]} intensity={1.4} />
      <pointLight position={[-5, -3, -2]} intensity={0.5} />
      {children}
      <AsciiPostEffect atlas={atlas} effect={effect} inkColor={inkColor} />
    </Canvas>
  )
}
