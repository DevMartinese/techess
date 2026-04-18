import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, Center } from '@react-three/drei'

const GLTF_MODELS = {
  bishop: { url: '/low_poly_bishop/scene.gltf', scale: 0.3 },
  rook: { url: '/low_poly_rook/scene.gltf', scale: 0.56 },
  knight: { url: '/knight_-_low_poly/scene.gltf', scale: 0.48 },
  king: { url: '/low_poly_king/scene.gltf', scale: 0.26 },
  pawn: { url: '/low_poly_pawn/scene.gltf', scale: 0.52 },
  queen: { url: '/queen_-_low_poly/scene.gltf', scale: 0.3 },
}

function Primitive({ variant }) {
  const material = (
    <meshStandardMaterial color="#f5f1ea" roughness={0.5} metalness={0.05} />
  )
  if (variant === 'sphere') {
    return (
      <mesh castShadow>
        <sphereGeometry args={[0.9, 48, 48]} />
        {material}
      </mesh>
    )
  }
  if (variant === 'box') {
    return (
      <mesh castShadow>
        <boxGeometry args={[1.2, 1.8, 1.2]} />
        {material}
      </mesh>
    )
  }
  return (
    <mesh castShadow>
      <capsuleGeometry args={[0.55, 1.1, 16, 32]} />
      {material}
    </mesh>
  )
}

function GltfModel({ url, scale, bottomAlign, dark }) {
  const { scene } = useGLTF(url)
  // Clone so multiple ChessPiece instances of the same variant can coexist
  // (three.js can't reparent a single object into multiple groups), and clone
  // every material so we can tune the surface response — flatter, less shiny —
  // and optionally recolor it to serve as the black army.
  const cloned = useMemo(() => {
    const c = scene.clone(true)
    c.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return
      const mat = obj.material.clone()
      if (dark && mat.color) mat.color.set('#181818')
      if ('roughness' in mat) mat.roughness = 0.85
      if ('metalness' in mat) mat.metalness = 0
      obj.material = mat
    })
    return c
  }, [scene, dark])
  // drei <Center> naming is counter-intuitive: `top` pushes the bbox UP from
  // the origin (so the bottom rests at y=0). That's what we want for a chess
  // piece sitting on its position. See node_modules/.../drei/core/Center.js:37
  return (
    <Center top={bottomAlign}>
      <primitive object={cloned} scale={scale} />
    </Center>
  )
}

export default function ChessPiece({
  variant = 'capsule',
  spinSpeed = 0.6,
  bottomAlign = false,
  dark = false,
  ...props
}) {
  const ref = useRef(null)
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * spinSpeed
  })
  const gltf = GLTF_MODELS[variant]
  return (
    <group {...props}>
      <group ref={ref}>
        {gltf ? (
          <GltfModel
            url={gltf.url}
            scale={gltf.scale}
            bottomAlign={bottomAlign}
            dark={dark}
          />
        ) : (
          <Primitive variant={variant} />
        )}
      </group>
    </group>
  )
}

Object.values(GLTF_MODELS).forEach(({ url }) => useGLTF.preload(url))
