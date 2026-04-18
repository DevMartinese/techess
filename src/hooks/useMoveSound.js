import { useCallback, useEffect, useRef } from 'react'
import * as Tone from 'tone'

/**
 * Dry "tap" evocative of a wooden piece touching the board. A short brown
 * noise burst is shaped by a lowpass + highpass chain — no pitched oscillator,
 * no musical tail, so it doesn't read as a video-game blip. The AudioContext
 * can only start in response to a user gesture, so nodes are built lazily on
 * the first call.
 */
export default function useMoveSound() {
  const nodesRef = useRef(null)

  useEffect(() => {
    return () => {
      const nodes = nodesRef.current
      if (!nodes) return
      nodes.noise.dispose()
      nodes.lowpass.dispose()
      nodes.highpass.dispose()
      nodesRef.current = null
    }
  }, [])

  return useCallback(async () => {
    if (!nodesRef.current) {
      const lowpass = new Tone.Filter({
        frequency: 900,
        type: 'lowpass',
        rolloff: -24,
      }).toDestination()
      const highpass = new Tone.Filter({
        frequency: 140,
        type: 'highpass',
        rolloff: -12,
      }).connect(lowpass)
      const noise = new Tone.NoiseSynth({
        noise: { type: 'brown' },
        envelope: {
          attack: 0.0005,
          decay: 0.022,
          sustain: 0,
          release: 0.01,
        },
        volume: -4,
      }).connect(highpass)
      nodesRef.current = { noise, lowpass, highpass }
    }
    if (Tone.getContext().state !== 'running') {
      try {
        await Tone.start()
      } catch {
        return
      }
    }
    nodesRef.current.noise.triggerAttackRelease('32n')
  }, [])
}
