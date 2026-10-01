import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Html, Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

import { useThemeColors } from '../../hooks/useThemeColors'
import ErrorBoundary from '../ErrorBoundary'
import BlochSphereSVG from './BlochSphereSVG'

/**
 * A Bloch sphere rendered with three.js.
 *
 * Bloch z (|0⟩ at the top) maps to three's y-up, and Bloch x (|+⟩) points
 * toward the viewer, which is the orientation every textbook draws.
 *
 * Everything is built from primitives -- no drei `Text`, no environment maps,
 * no textures -- because those fetch assets from a CDN at runtime and this
 * view has to work with the network unplugged. Labels are HTML overlays.
 */

const toThree = (v) => [v.y, v.z, v.x]

let webglSupport = null

/** Probed once: without WebGL, three.js throws and would take the page down. */
function hasWebGL() {
  if (webglSupport === null) {
    try {
      const canvas = document.createElement('canvas')
      webglSupport = Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
    } catch {
      webglSupport = false
    }
  }
  return webglSupport
}

const POLES = [
  { label: '|0⟩', v: { x: 0, y: 0, z: 1.28 }, major: true },
  { label: '|1⟩', v: { x: 0, y: 0, z: -1.28 }, major: true },
  { label: '|+⟩', v: { x: 1.3, y: 0, z: 0 } },
  { label: '|−⟩', v: { x: -1.3, y: 0, z: 0 } },
  { label: '|+i⟩', v: { x: 0, y: 1.3, z: 0 } },
  { label: '|−i⟩', v: { x: 0, y: -1.3, z: 0 } },
]

function circle(plane, radius = 1, offset = 0, segments = 96) {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const a = (i / segments) * Math.PI * 2
    const u = Math.cos(a) * radius
    const w = Math.sin(a) * radius
    if (plane === 'xz') return [u, offset, w]
    if (plane === 'xy') return [u, w, offset]
    return [offset, u, w]
  })
}

const UP = new THREE.Vector3(0, 1, 0)

function Arrow({ vector, color, opacity = 1, thick = 1 }) {
  const { quaternion, length } = useMemo(() => {
    const dir = new THREE.Vector3(...toThree(vector))
    const len = dir.length()
    const q = new THREE.Quaternion()
    if (len > 1e-6) q.setFromUnitVectors(UP, dir.clone().normalize())
    return { quaternion: q, length: len }
  }, [vector])

  if (length < 0.02) {
    // A fully mixed state has no direction -- show it as a dot at the centre.
    return (
      <mesh>
        <sphereGeometry args={[0.05 * thick, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} transparent opacity={opacity} />
      </mesh>
    )
  }

  const head = Math.min(0.16, length * 0.4)
  const shaft = length - head
  const transparent = opacity < 1
  return (
    <group quaternion={quaternion}>
      <mesh position={[0, shaft / 2, 0]}>
        <cylinderGeometry args={[0.018 * thick, 0.018 * thick, shaft, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} transparent={transparent} opacity={opacity} />
      </mesh>
      <mesh position={[0, shaft + head / 2, 0]}>
        <coneGeometry args={[0.055 * thick, head, 20]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} transparent={transparent} opacity={opacity} />
      </mesh>
      <mesh position={[0, length, 0]}>
        <sphereGeometry args={[0.04 * thick, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.35 * opacity} />
      </mesh>
    </group>
  )
}

function Scene({ vector, ghost, trail, labels, colors, accent, ghostColor, compact }) {
  const grid = colors['slate-600']
  const trailPoints = useMemo(() => (trail && trail.length > 1 ? trail.map(toThree) : null), [trail])

  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 4, 5]} intensity={1.1} />

      <mesh>
        <sphereGeometry args={[1, 48, 32]} />
        <meshStandardMaterial color={colors['signal-cyan']} transparent opacity={0.07} depthWrite={false} />
      </mesh>

      <Line points={circle('xz')} color={grid} lineWidth={1} transparent opacity={0.7} />
      <Line points={circle('xy')} color={grid} lineWidth={0.7} transparent opacity={0.35} />
      <Line points={circle('yz')} color={grid} lineWidth={0.7} transparent opacity={0.35} />
      {!compact && (
        <>
          <Line points={circle('xz', Math.SQRT1_2, Math.SQRT1_2)} color={grid} lineWidth={0.5} transparent opacity={0.2} />
          <Line points={circle('xz', Math.SQRT1_2, -Math.SQRT1_2)} color={grid} lineWidth={0.5} transparent opacity={0.2} />
        </>
      )}

      {[
        [[0, -1.15, 0], [0, 1.15, 0]],
        [[-1.15, 0, 0], [1.15, 0, 0]],
        [[0, 0, -1.15], [0, 0, 1.15]],
      ].map((pts, i) => (
        <Line key={i} points={pts} color={colors['slate-500']} lineWidth={0.8} transparent opacity={0.6} dashed={i > 0} dashSize={0.05} gapSize={0.04} />
      ))}

      {labels &&
        POLES.filter((p) => !compact || p.major).map((p) => (
          <Html key={p.label} position={toThree(p.v)} center style={{ pointerEvents: 'none' }}>
            <span
              className={`select-none whitespace-nowrap font-mono ${compact ? 'text-[9px]' : 'text-[11px]'} ${
                p.major ? 'text-slate-300' : 'text-slate-500'
              }`}
            >
              {p.label}
            </span>
          </Html>
        ))}

      {trailPoints && <Line points={trailPoints} color={accent} lineWidth={2} transparent opacity={0.45} />}
      {ghost && <Arrow vector={ghost} color={ghostColor} opacity={0.45} thick={compact ? 0.8 : 1} />}
      <Arrow vector={vector} color={accent} thick={compact ? 1.2 : 1} />
    </>
  )
}

export default function BlochSphere3D({
  vector,
  ghost = null,
  trail = null,
  labels = true,
  interactive = true,
  compact = false,
  accent: accentToken = 'signal-cyan',
  ghostAccent = 'signal-violet',
  className = '',
  flat: forceFlat = false,
}) {
  const colors = useThemeColors()
  const accent = colors[accentToken]

  const flat = (
    <BlochSphereSVG
      vector={vector}
      ghost={ghost}
      trail={trail}
      labels={labels}
      compact={compact}
      accent={accentToken}
      ghostAccent={ghostAccent}
      className={className}
    />
  )
  // Many small spheres would each need their own WebGL context, and browsers
  // cap those at about sixteen: callers drawing lots of them ask for SVG.
  if (forceFlat || !hasWebGL()) return flat

  return (
    <ErrorBoundary fallback={flat}>
      <div className={className}>
        <Canvas
          frameloop="demand"
          dpr={[1, 2]}
          camera={{ position: compact ? [2.5, 1.75, 3.2] : [2.2, 1.45, 2.7], fov: compact ? 38 : 40 }}
          gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        >
          <Scene vector={vector} ghost={ghost} trail={trail} labels={labels} colors={colors} accent={accent} ghostColor={colors[ghostAccent]} compact={compact} />
          {interactive && <OrbitControls enablePan={false} enableZoom={false} rotateSpeed={0.6} />}
        </Canvas>
      </div>
    </ErrorBoundary>
  )
}
