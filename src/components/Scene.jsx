import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  Environment,
  ContactShadows,
  Float,
  PerspectiveCamera,
} from '@react-three/drei'
import ChessPiece from './ChessPiece'
import ScatteredPieces from './ScatteredPieces'

export default function Scene({
  variant = 'capsule',
  layout = 'single',
  scatteredConfig,
}) {
  const scattered = layout === 'scattered'
  return (
    <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
      <PerspectiveCamera
        makeDefault
        position={scattered ? [0, 0, 7] : [0, 0, 4.5]}
        fov={scattered ? 40 : 35}
      />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[3, 5, 2]}
        intensity={1.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <Environment preset="studio" />
      <Suspense fallback={null}>
        {scattered ? (
          <ScatteredPieces config={scatteredConfig} />
        ) : (
          <Float speed={1.4} rotationIntensity={0.35} floatIntensity={0.6}>
            <ChessPiece variant={variant} rotation={[0, -0.25, 0.08]} />
          </Float>
        )}
      </Suspense>
      {!scattered && (
        <ContactShadows
          position={[0, -1.4, 0]}
          opacity={0.5}
          scale={6}
          blur={2.8}
          far={2.5}
          resolution={512}
        />
      )}
    </Canvas>
  )
}
