// @ts-nocheck — backup file, not in active compilation
/* ============================================================
 * Chamber3D — REGIA hemicycle in Three.js (@react-three/fiber + drei)
 * BACKUP — kept for reference. Not compiled. See Chamber3D.tsx.
 * ============================================================ */

import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { ContactShadows, Html, OrbitControls, Sparkles } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { Loader2, MousePointerClick, Rotate3d, RotateCcw } from 'lucide-react'
import type { Region, RegionId, Vote } from '../lib/engine'
import { SeatQuickSelect } from './SeatQuickSelect'

/* ------------------------------------------------------------ colours */
import { GOLD_HEX, NEUTRAL_HEX, VOTE_HEX } from '../lib/voteColours'
export { GOLD_HEX, NEUTRAL_HEX, VOTE_HEX }

const SUIT_COLOURS = ['#1e3a5f', '#334155', '#3f2d20', '#243b53', '#4a2545']
const SKIN_TONES = ['#c9a07c', '#a97c50', '#8d6239', '#d9b48f', '#b98a5e']

/* ------------------------------------------------------------ layout */

/** Centre of the hemicycle (presidency side) and seat radius. */
const CENTRE = { x: 0, z: -1.4 }
const SEAT_RADIUS = 5.6
const PLATFORM_Y = 0.48
const SEAT_ANGLES_DEG = [-64, -32, 0, 32, 64]

function seatTransform(index: number) {
  const phi = THREE.MathUtils.degToRad(SEAT_ANGLES_DEG[index] ?? 0)
  const x = CENTRE.x + SEAT_RADIUS * Math.sin(phi)
  const z = CENTRE.z + SEAT_RADIUS * Math.cos(phi)
  const y = PLATFORM_Y + Math.abs(index - 2) * 0.14
  const rotationY = Math.atan2(CENTRE.x - x, CENTRE.z - z)
  return { position: [x, y, z] as [number, number, number], rotationY }
}

/* ------------------------------------------------------------ props */

export interface Chamber3DProps {
  regions: Region[]
  /** Vote per region, or null before any simulation */
  votes: Record<RegionId, Vote> | null
  revealed: boolean
  /** Increment to replay the rise-and-light-up reveal animation */
  revealKey: number
  losingRegionId: RegionId | null
  amendmentActive: boolean
  selectedId: RegionId | null
  onSelect: (id: RegionId) => void
}

/* ------------------------------------------------------------ one seat */

interface SeatProps {
  region: Region
  index: number
  vote: Vote | null
  revealed: boolean
  revealKey: number
  isGoldTarget: boolean
  selected: boolean
  onSelect: (id: RegionId) => void
}

function Seat({ region, index, vote, revealed, revealKey, isGoldTarget, selected, onSelect }: SeatProps) {
  const { position, rotationY } = useMemo(() => seatTransform(index), [index])
  const rising = useRef<THREE.Group>(null!)
  const ring = useRef<THREE.Mesh>(null!)
  const goldLight = useRef<THREE.PointLight>(null)
  const revealStart = useRef<number | null>(null)
  const [hovered, setHovered] = useState(false)

  /* Vote-coloured materials, shared across this seat's glowing parts. */
  const panelMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: NEUTRAL_HEX,
        emissive: NEUTRAL_HEX,
        emissiveIntensity: 0.2,
        roughness: 0.38,
        metalness: 0.3,
      }),
    [],
  )
  const lampMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: NEUTRAL_HEX,
        emissive: NEUTRAL_HEX,
        emissiveIntensity: 0.4,
        roughness: 0.25,
        metalness: 0.1,
      }),
    [],
  )
  useEffect(
    () => () => {
      panelMat.dispose()
      lampMat.dispose()
    },
    [panelMat, lampMat],
  )

  const targetColour = useMemo(() => {
    const hex = isGoldTarget ? GOLD_HEX : revealed && vote ? VOTE_HEX[vote] : NEUTRAL_HEX
    return new THREE.Color(hex)
  }, [isGoldTarget, revealed, vote])

  /* Replay the reveal from scratch whenever revealKey changes. */
  useEffect(() => {
    revealStart.current = null
  }, [revealKey])

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : ''
    return () => {
      document.body.style.cursor = ''
    }
  }, [hovered])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const g = rising.current
    if (!g) return

    /* --- rise (staggered ease-out once the vote is revealed) --- */
    let targetY = 0
    let targetGlow = 0.22
    if (revealed) {
      if (revealStart.current === null) revealStart.current = t
      const raw = THREE.MathUtils.clamp((t - revealStart.current - index * 0.22) / 0.65, 0, 1)
      const eased = 1 - Math.pow(1 - raw, 3)
      targetY = eased * 0.55
      targetGlow = 0.25 + eased * 1.15
    }
    if (isGoldTarget) {
      targetGlow = 1.55 + Math.sin(t * 3.2) * 0.55
      targetY += 0.14 + Math.sin(t * 2) * 0.04
    }
    if (selected) {
      targetY += 0.1
      targetGlow += 0.35
    }
    if (hovered) {
      targetY += 0.07
      targetGlow += 0.5
    }
    g.position.y = THREE.MathUtils.damp(g.position.y, targetY, 7, delta)

    /* --- colour + glow --- */
    const k = 1 - Math.exp(-8 * delta)
    panelMat.color.lerp(targetColour, k)
    panelMat.emissive.lerp(targetColour, k)
    panelMat.emissiveIntensity = THREE.MathUtils.damp(panelMat.emissiveIntensity, targetGlow, 8, delta)
    lampMat.color.lerp(targetColour, k)
    lampMat.emissive.lerp(targetColour, k)
    lampMat.emissiveIntensity = THREE.MathUtils.damp(
      lampMat.emissiveIntensity,
      targetGlow * 1.9,
      8,
      delta,
    )

    /* --- selection / amendment ring --- */
    if (ring.current) {
      const mat = ring.current.material as THREE.MeshBasicMaterial
      const active = selected || isGoldTarget
      ring.current.visible = active
      if (active) {
        const s = 1 + Math.sin(t * 2.4) * 0.045
        ring.current.scale.set(s, s, s)
        mat.opacity = isGoldTarget ? 0.75 + Math.sin(t * 3.2) * 0.25 : 0.85
        mat.color.set(isGoldTarget ? GOLD_HEX : '#ffffff')
      }
    }
    if (goldLight.current) {
      goldLight.current.intensity = isGoldTarget ? 26 + Math.sin(t * 3.2) * 10 : 0
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onSelect(region.id)
  }
  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHovered(true)
  }
  const handleOut = () => setHovered(false)

  const suit = SUIT_COLOURS[index % SUIT_COLOURS.length]
  const skin = SKIN_TONES[index % SKIN_TONES.length]
  const surname = region.deputy.split(' ').slice(-1)[0]

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* selection ring — sits on the platform, does not rise */}
      <mesh ref={ring} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[1.18, 1.36, 48]} />
        <meshBasicMaterial transparent opacity={0.85} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <pointLight ref={goldLight} position={[0, 2.4, 0]} color={GOLD_HEX} intensity={0} distance={6} decay={2} />
      {isGoldTarget && (
        <Sparkles count={22} scale={[2.2, 1.8, 2.2]} position={[0, 1.4, 0]} size={3} speed={0.6} color={GOLD_HEX} />
      )}

      {/* rising seat assembly */}
      <group ref={rising} onClick={handleClick} onPointerOver={handleOver} onPointerOut={handleOut}>
        {/* glowing plinth */}
        <mesh material={panelMat} position={[0, 0.09, 0]} receiveShadow>
          <boxGeometry args={[1.95, 0.18, 1.75]} />
        </mesh>

        {/* desk (front, facing the podium) */}
        <mesh position={[0, 0.62, 0.3]} castShadow receiveShadow>
          <boxGeometry args={[1.7, 0.75, 0.62]} />
          <meshStandardMaterial color="#4a3421" roughness={0.6} metalness={0.15} />
        </mesh>
        <mesh position={[0, 1.03, 0.3]} castShadow>
          <boxGeometry args={[1.85, 0.09, 0.78]} />
          <meshStandardMaterial color="#6b4a2f" roughness={0.5} metalness={0.2} />
        </mesh>
        <mesh material={panelMat} position={[0, 0.62, 0.63]}>
          <boxGeometry args={[1.5, 0.5, 0.05]} />
        </mesh>
        {/* brass nameplate */}
        <mesh position={[0, 0.82, 0.67]} rotation={[-0.12, 0, 0]}>
          <boxGeometry args={[0.82, 0.16, 0.03]} />
          <meshStandardMaterial color="#c9a227" roughness={0.3} metalness={0.85} />
        </mesh>

        {/* chair — glowing back faces the public gallery / camera */}
        <mesh position={[0, 0.52, -0.5]} castShadow>
          <boxGeometry args={[0.72, 0.16, 0.62]} />
          <meshStandardMaterial color="#6d1420" roughness={0.7} metalness={0.05} />
        </mesh>
        <mesh material={panelMat} position={[0, 1.08, -0.82]} castShadow>
          <boxGeometry args={[0.76, 1.06, 0.13]} />
        </mesh>
        <mesh position={[0, 1.08, -0.74]}>
          <boxGeometry args={[0.62, 0.86, 0.06]} />
          <meshStandardMaterial color="#6d1420" roughness={0.7} metalness={0.05} />
        </mesh>

        {/* deputy figure — cylinder torso, sphere head & shoulders */}
        <mesh position={[0, 0.98, -0.48]} castShadow>
          <cylinderGeometry args={[0.17, 0.24, 0.55, 14]} />
          <meshStandardMaterial color={suit} roughness={0.75} metalness={0.05} />
        </mesh>
        <mesh position={[0, 1.2, -0.48]} scale={[1.3, 0.55, 0.85]} castShadow>
          <sphereGeometry args={[0.26, 18, 12]} />
          <meshStandardMaterial color={suit} roughness={0.75} metalness={0.05} />
        </mesh>
        <mesh position={[0, 1.46, -0.48]} castShadow>
          <sphereGeometry args={[0.165, 20, 16]} />
          <meshStandardMaterial color={skin} roughness={0.6} metalness={0.02} />
        </mesh>

        {/* microphone */}
        <mesh position={[0.35, 1.24, 0.12]} rotation={[0.65, 0, -0.15]}>
          <cylinderGeometry args={[0.018, 0.018, 0.5, 8]} />
          <meshStandardMaterial color="#111827" roughness={0.4} metalness={0.6} />
        </mesh>
        <mesh material={panelMat} position={[0.39, 1.42, -0.02]}>
          <sphereGeometry args={[0.045, 12, 10]} />
        </mesh>

        {/* vote lamp on the desk */}
        <mesh position={[-0.48, 1.12, 0.32]}>
          <cylinderGeometry args={[0.025, 0.04, 0.1, 10]} />
          <meshStandardMaterial color="#111827" roughness={0.4} metalness={0.6} />
        </mesh>
        <mesh material={lampMat} position={[-0.48, 1.23, 0.32]}>
          <sphereGeometry args={[0.09, 16, 12]} />
        </mesh>

        {/* region label (also clickable) */}
        <Html center distanceFactor={9} position={[0, 2.2, 0]} zIndexRange={[30, 0]} wrapperClass="seat-label-wrap">
          <button
            type="button"
            onClick={() => onSelect(region.id)}
            className={`block whitespace-nowrap rounded-xl border px-3 py-1.5 text-center shadow-lg backdrop-blur transition ${
              selected
                ? 'border-white/70 bg-slate-900/95'
                : 'border-white/15 bg-slate-950/80 hover:border-white/40'
            }`}
          >
            <span className="block text-[13px] font-bold tracking-wide text-white">{region.name}</span>
            <span className="block text-[10px] font-medium text-slate-300">{surname}</span>
            {isGoldTarget ? (
              <span
                className="mt-1 block rounded-full px-2 py-0.5 text-[9px] font-extrabold tracking-widest text-slate-950"
                style={{ background: GOLD_HEX }}
              >
                AMENDMENT TARGET
              </span>
            ) : revealed && vote ? (
              <span
                className="mt-1 block rounded-full px-2 py-0.5 text-[9px] font-extrabold tracking-widest text-white"
                style={{ background: VOTE_HEX[vote] }}
              >
                {vote}
              </span>
            ) : (
              <span className="mt-1 block rounded-full bg-slate-700 px-2 py-0.5 text-[9px] font-extrabold tracking-widest text-slate-200">
                NO VOTE YET
              </span>
            )}
          </button>
        </Html>
      </group>
    </group>
  )
}

/* ------------------------------------------------------------ chamber shell */

function Flag({ x }: { x: number }) {
  const inward = x < 0 ? 1 : -1
  return (
    <group position={[x, PLATFORM_Y, -3.9]}>
      <mesh position={[0, 1.7, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 3.4, 10]} />
        <meshStandardMaterial color="#9aa7bd" roughness={0.35} metalness={0.8} />
      </mesh>
      <mesh position={[0, 3.48, 0]}>
        <sphereGeometry args={[0.08, 14, 10]} />
        <meshStandardMaterial color="#c9a227" roughness={0.3} metalness={0.85} />
      </mesh>
      <mesh position={[inward * 0.55, 3.05, 0]} castShadow>
        <boxGeometry args={[1.05, 0.68, 0.035]} />
        <meshStandardMaterial color="#c8102e" roughness={0.65} metalness={0.05} />
      </mesh>
      <mesh position={[inward * 0.55, 3.05, 0.028]}>
        <circleGeometry args={[0.17, 24]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.6} />
      </mesh>
      <mesh position={[inward * 0.55, 3.05, 0.034]}>
        <circleGeometry args={[0.1, 24]} />
        <meshStandardMaterial color="#c8102e" roughness={0.6} />
      </mesh>
    </group>
  )
}

function Podium() {
  return (
    <group position={[0, PLATFORM_Y, -2.8]}>
      {/* presidency desk */}
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.6, 0.9, 0.85]} />
        <meshStandardMaterial color="#3a2817" roughness={0.55} metalness={0.2} />
      </mesh>
      <mesh position={[0, 1.04, 0]} castShadow>
        <boxGeometry args={[3.88, 0.1, 1.02]} />
        <meshStandardMaterial color="#6b4a2f" roughness={0.45} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0.58, 0.45]}>
        <boxGeometry args={[1.6, 0.42, 0.04]} />
        <meshStandardMaterial color="#c9a227" roughness={0.3} metalness={0.85} emissive="#c9a227" emissiveIntensity={0.15} />
      </mesh>
      {/* president's high-back chair */}
      <group position={[0, 0, -0.9]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[0.85, 0.18, 0.7]} />
          <meshStandardMaterial color="#6d1420" roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.45, -0.34]} castShadow>
          <boxGeometry args={[0.9, 1.7, 0.15]} />
          <meshStandardMaterial color="#5b0f1a" roughness={0.65} />
        </mesh>
        <mesh position={[-0.45, 2.36, -0.34]}>
          <sphereGeometry args={[0.07, 12, 10]} />
          <meshStandardMaterial color="#c9a227" roughness={0.3} metalness={0.85} />
        </mesh>
        <mesh position={[0.45, 2.36, -0.34]}>
          <sphereGeometry args={[0.07, 12, 10]} />
          <meshStandardMaterial color="#c9a227" roughness={0.3} metalness={0.85} />
        </mesh>
      </group>
      {/* vice-presidents' chairs */}
      {[-1.25, 1.25].map((x) => (
        <group key={x} position={[x, 0, -0.85]}>
          <mesh position={[0, 0.52, 0]} castShadow>
            <boxGeometry args={[0.66, 0.16, 0.6]} />
            <meshStandardMaterial color="#6d1420" roughness={0.7} />
          </mesh>
          <mesh position={[0, 1.1, -0.3]} castShadow>
            <boxGeometry args={[0.7, 1.05, 0.13]} />
            <meshStandardMaterial color="#5b0f1a" roughness={0.65} />
          </mesh>
        </group>
      ))}
      {/* podium microphones */}
      {[-0.3, 0.3].map((x) => (
        <group key={x} position={[x, 1.09, 0.18]}>
          <mesh rotation={[0.6, 0, x < 0 ? 0.2 : -0.2]} position={[0, 0.14, -0.06]}>
            <cylinderGeometry args={[0.016, 0.016, 0.42, 8]} />
            <meshStandardMaterial color="#111827" roughness={0.4} metalness={0.6} />
          </mesh>
          <mesh position={[x < 0 ? -0.05 : 0.05, 0.3, -0.14]}>
            <sphereGeometry args={[0.04, 12, 10]} />
            <meshStandardMaterial color="#c9a227" roughness={0.35} metalness={0.7} emissive="#c9a227" emissiveIntensity={0.4} />
          </mesh>
        </group>
      ))}
      <Html center distanceFactor={10} position={[0, 2.15, 0]} zIndexRange={[30, 0]}>
        <div className="whitespace-nowrap rounded-full border border-amber-300/30 bg-slate-950/80 px-3 py-1 text-[10px] font-extrabold tracking-[0.22em] text-amber-200 backdrop-blur">
          PRESIDENCY
        </div>
      </Html>
    </group>
  )
}

function ChamberShell() {
  const steps = [
    { r: 8.8, h: 0.16, colour: '#0e1830' },
    { r: 7.6, h: 0.32, colour: '#14213d' },
    { r: 6.4, h: PLATFORM_Y, colour: '#182949' },
  ]
  return (
    <group>
      {/* floor */}
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[16, 48]} />
        <meshStandardMaterial color="#0a1120" roughness={0.9} metalness={0.05} />
      </mesh>
      {/* semicircular stepped tiers */}
      {steps.map(({ r, h, colour }) => (
        <mesh key={r} position={[CENTRE.x, h / 2, CENTRE.z]} receiveShadow>
          <cylinderGeometry args={[r, r, h, 56, 1, false, THREE.MathUtils.degToRad(-100), THREE.MathUtils.degToRad(200)]} />
          <meshStandardMaterial color={colour} roughness={0.75} metalness={0.12} />
        </mesh>
      ))}
      {/* brass inlay ring on the platform edge */}
      <mesh position={[CENTRE.x, PLATFORM_Y + 0.012, CENTRE.z]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[6.15, 0.025, 8, 80, Math.PI]} />
        <meshStandardMaterial color="#c9a227" roughness={0.3} metalness={0.85} emissive="#c9a227" emissiveIntensity={0.25} />
      </mesh>

      {/* back wall, wood panel and emblem */}
      <mesh position={[0, 2.2, -4.7]} receiveShadow>
        <boxGeometry args={[16, 4.6, 0.35]} />
        <meshStandardMaterial color="#101a30" roughness={0.85} />
      </mesh>
      <mesh position={[0, 2.1, -4.48]}>
        <boxGeometry args={[9.5, 3.1, 0.08]} />
        <meshStandardMaterial color="#2a1f18" roughness={0.6} metalness={0.15} />
      </mesh>
      <mesh position={[0, 3.25, -4.4]}>
        <torusGeometry args={[0.52, 0.055, 12, 40]} />
        <meshStandardMaterial color="#c9a227" roughness={0.3} metalness={0.85} emissive="#c9a227" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, 3.25, -4.4]}>
        <circleGeometry args={[0.3, 28]} />
        <meshStandardMaterial color="#c8102e" roughness={0.6} />
      </mesh>
      {/* columns */}
      {[-6.6, -4.4, -2.2, 2.2, 4.4, 6.6].map((x) => (
        <group key={x} position={[x, 0, -4.35]}>
          <mesh position={[0, 2.1, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.24, 4.2, 14]} />
            <meshStandardMaterial color="#24304d" roughness={0.55} metalness={0.25} />
          </mesh>
          <mesh position={[0, 4.28, 0]}>
            <boxGeometry args={[0.58, 0.16, 0.58]} />
            <meshStandardMaterial color="#c9a227" roughness={0.35} metalness={0.8} />
          </mesh>
        </group>
      ))}
      {/* hanging light ring over the chamber */}
      <mesh position={[0, 4.9, -0.8]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.7, 0.035, 10, 64]} />
        <meshStandardMaterial color="#e8c96a" emissive="#f5c542" emissiveIntensity={1.0} roughness={0.4} />
      </mesh>
      <Flag x={-2.8} />
      <Flag x={2.8} />
      <Podium />
    </group>
  )
}

/* ------------------------------------------------------------ responsive camera */

function CameraRig() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  useEffect(() => {
    const persp = camera as THREE.PerspectiveCamera
    const aspect = size.width / size.height
    if (aspect < 0.9) {
      persp.position.set(0, 11.5, 21)
      persp.fov = 48
    } else if (aspect < 1.35) {
      persp.position.set(0, 9.4, 17)
      persp.fov = 42
    } else {
      persp.position.set(0, 8.2, 14.6)
      persp.fov = 40
    }
    persp.updateProjectionMatrix()
    if (controls) {
      controls.target.set(0, 1.1, -0.6)
      controls.update()
      controls.saveState()
    }
  }, [camera, size, controls])
  return null
}

/* ------------------------------------------------------------ error fallback */

class ChamberErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/* ------------------------------------------------------------ main component */

export default function Chamber3D({
  regions,
  votes,
  revealed,
  revealKey,
  losingRegionId,
  amendmentActive,
  selectedId,
  onSelect,
}: Chamber3DProps) {
  const controls = useRef<OrbitControlsImpl>(null)
  const [ready, setReady] = useState(false)
  const [autoRotate, setAutoRotate] = useState(false)

  const resetView = () => controls.current?.reset()

  const fallback2D = (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#070d1a] p-6 text-center">
      <p className="text-sm font-semibold text-slate-200">3D chamber unavailable on this device</p>
      <p className="max-w-sm text-xs leading-relaxed text-slate-400">
        WebGL could not be started. Select a deputy below — the detail panel, votes and simulation work exactly the same.
      </p>
      <SeatQuickSelect regions={regions} votes={votes} revealed={revealed} selectedId={selectedId} onSelect={onSelect} />
    </div>
  )

  return (
    <div className="relative h-[440px] w-full overflow-hidden bg-[#070d1a] sm:h-[520px]">
      <ChamberErrorBoundary fallback={fallback2D}>
        <Canvas
          shadows
          dpr={[1, 1.75]}
          camera={{ position: [0, 8.2, 14.6], fov: 40, near: 0.1, far: 70 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          onCreated={() => setReady(true)}
        >
          <color attach="background" args={['#070d1a']} />
          <fog attach="fog" args={['#070d1a', 20, 42]} />

          {/* lighting — no HDR / external assets */}
          <ambientLight intensity={0.45} />
          <hemisphereLight args={['#93c5fd', '#1e293b', 0.55]} />
          <directionalLight
            position={[7, 11, 7]}
            intensity={1.7}
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-camera-left={-11}
            shadow-camera-right={11}
            shadow-camera-top={11}
            shadow-camera-bottom={-11}
          />
          <spotLight position={[0, 11, -1]} angle={0.75} penumbra={1} intensity={170} distance={34} decay={1.6} color="#fde8b0" />
          <pointLight position={[0, 4.4, 3.5]} intensity={14} distance={16} decay={2} color="#7dd3fc" />

          <Suspense fallback={null}>
            <ChamberShell />
            {regions.map((region, i) => (
              <Seat
                key={region.id}
                region={region}
                index={i}
                vote={votes ? votes[region.id] : null}
                revealed={revealed}
                revealKey={revealKey}
                isGoldTarget={amendmentActive && losingRegionId === region.id}
                selected={selectedId === region.id}
                onSelect={onSelect}
              />
            ))}
          </Suspense>

          <Sparkles count={45} scale={[17, 5, 11]} position={[0, 3.2, -0.5]} size={1.5} speed={0.22} opacity={0.3} color="#f5c542" />
          <ContactShadows position={[0, 0.02, 0]} scale={26} blur={2.4} opacity={0.5} far={6} resolution={512} color="#000000" />
          <OrbitControls
            ref={controls}
            makeDefault
            target={[0, 1.1, -0.6]}
            enablePan={false}
            enableDamping
            dampingFactor={0.08}
            minDistance={6}
            maxDistance={21}
            minPolarAngle={0.35}
            maxPolarAngle={1.42}
            autoRotate={autoRotate}
            autoRotateSpeed={0.7}
          />
          <CameraRig />
        </Canvas>
      </ChamberErrorBoundary>

      {/* loading veil */}
      {!ready && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#070d1a]">
          <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin text-amber-300" /> PREPARING THE HEMICYCLE…
          </span>
        </div>
      )}

      {/* legend */}
      <div className="absolute left-3 top-3 z-10 hidden rounded-xl border border-white/10 bg-slate-950/75 px-3 py-2 backdrop-blur sm:block">
        <p className="mb-1.5 text-[9px] font-extrabold tracking-[0.2em] text-slate-400">SEAT COLOURS</p>
        <ul className="space-y-1 text-[11px] font-medium text-slate-200">
          <LegendDot hex={NEUTRAL_HEX} label="Before the vote" />
          <LegendDot hex={VOTE_HEX.APPROVE} label="Approve" />
          <LegendDot hex={VOTE_HEX.REJECT} label="Reject" />
          <LegendDot hex={VOTE_HEX.ABSTAIN} label="Abstain" />
          <LegendDot hex={GOLD_HEX} label="Amendment target (losing region)" />
        </ul>
      </div>

      {/* camera controls + hints */}
      <div className="absolute right-3 top-3 z-10 flex gap-2">
        <button
          type="button"
          onClick={() => setAutoRotate((v) => !v)}
          aria-pressed={autoRotate}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold backdrop-blur transition ${
            autoRotate
              ? 'border-amber-300/60 bg-amber-400/20 text-amber-100'
              : 'border-white/15 bg-slate-950/75 text-slate-200 hover:border-white/40'
          }`}
        >
          <Rotate3d className="h-3.5 w-3.5" /> Auto-rotate
        </button>
        <button
          type="button"
          onClick={resetView}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-slate-950/75 px-3 py-1.5 text-[11px] font-bold text-slate-200 backdrop-blur transition hover:border-white/40"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset view
        </button>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-slate-950/70 px-3.5 py-1.5 text-[11px] font-medium text-slate-300 backdrop-blur">
        <span className="inline-flex items-center gap-1.5">
          <MousePointerClick className="h-3.5 w-3.5 text-amber-300" />
          <span className="hidden sm:inline">Drag to rotate · Scroll to zoom · Click a seat to inspect its deputy</span>
          <span className="sm:hidden">Drag · Pinch · Tap a seat</span>
        </span>
      </div>
    </div>
  )
}

function LegendDot({ hex, label }: { hex: string; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: hex, boxShadow: `0 0 8px ${hex}` }} />
      {label}
    </li>
  )
}
