import { Float } from '@react-three/drei'
import ChessPiece from './ChessPiece'

const PIECE_META = {
  king: { floatSpeed: 1.2 },
  queen: { floatSpeed: 1.6 },
  rook: { floatSpeed: 1.3 },
  bishop: { floatSpeed: 1.5 },
  knight: { floatSpeed: 1.1 },
  pawn: { floatSpeed: 1.8 },
}

export default function ScatteredPieces({ config }) {
  return (
    <>
      {Object.entries(config).map(([variant, p]) => {
        const meta = PIECE_META[variant]
        return (
          <Float
            key={variant}
            speed={meta.floatSpeed}
            rotationIntensity={0.3}
            floatIntensity={0.5}
          >
            <ChessPiece
              variant={variant}
              position={[p.x, p.y, p.z]}
              scale={p.scale}
              spinSpeed={0}
              rotation={[p.rx, p.ry, p.rz]}
            />
          </Float>
        )
      })}
    </>
  )
}
