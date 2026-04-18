import { Suspense } from 'react'
import { Float, PerspectiveCamera } from '@react-three/drei'
import ShaderCanvas from './shaderCanvas'
import ChessPiece from './ChessPiece'
import ScatteredPieces from './ScatteredPieces'

export default function ShaderScene({
  variant = 'capsule',
  layout = 'single',
  effect = 'etch',
  inkColor = [0, 0, 0],
  scatteredConfig,
}) {
  const scattered = layout === 'scattered'
  return (
    <ShaderCanvas effect={effect} inkColor={inkColor}>
      <PerspectiveCamera
        makeDefault
        position={scattered ? [0, 0, 7] : [0, 0, 4.5]}
        fov={scattered ? 40 : 35}
      />
      <Suspense fallback={null}>
        {scattered ? (
          <ScatteredPieces config={scatteredConfig} />
        ) : (
          <Float speed={1.4} rotationIntensity={0.35} floatIntensity={0.6}>
            <ChessPiece variant={variant} rotation={[0, -0.25, 0.08]} />
          </Float>
        )}
      </Suspense>
    </ShaderCanvas>
  )
}
