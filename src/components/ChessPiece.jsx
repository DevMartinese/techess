import { useRef } from 'react'
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

function GltfModel({ url, scale }) {
  const { scene } = useGLTF(url)
  return (
    <Center>
      <primitive object={scene} scale={scale} />
    </Center>
  )
}

export default function ChessPiece({
  variant = 'capsule',
  spinSpeed = 0.6,
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
          <GltfModel url={gltf.url} scale={gltf.scale} />
        ) : (
          <Primitive variant={variant} />
        )}
      </group>
    </group>
  )
}

Object.values(GLTF_MODELS).forEach(({ url }) => useGLTF.preload(url))
