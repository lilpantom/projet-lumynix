import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { BODIES } from '../../data/bodies'
import { NODES } from '../../data/nodes'
import { usePrefs } from '../../context/PreferencesContext'
import { relayOperational } from '../../sim/comms'
import { bodyPosition, nodePosition } from '../../sim/orbits'
import { fleetViews } from '../../sim/selectors'
import { arrivalTime, departureTime, shipPosition, shipVelocity } from '../../sim/trajectory'
import { TICK_MS, useSim } from '../../store/simStore'
import { useUi } from '../../store/uiStore'
import type { Conflict, RiskLevel, Ship, Vec2 } from '../../types'
import { displayRadius, sceneColors, toDisplay, type SceneColors } from './projection'

/** Display (x, y) → world (x, 0, −y), so counter-clockwise orbits stay counter-clockwise from above. */
const world = (p: Vec2, h = 0) => new THREE.Vector3(p.x, h, -p.y)
const worldOf = (au: Vec2, h = 0) => world(toDisplay(au), h)

/** Sim time interpolated between 1 s ticks so motion is smooth. */
function liveSimTime() {
  const s = useSim.getState()
  if (!s.running) return s.sim.time
  const f = Math.min(1, (performance.now() - s.lastTickWall) / TICK_MS)
  return s.sim.time + f * s.speed * 60_000
}

const HOME = { target: new THREE.Vector3(0, 0, 0), cam: new THREE.Vector3(0, 230, 200) }
type Registry = Map<string, THREE.Object3D>

function disposeLine(l: THREE.Line) {
  l.geometry.dispose()
  ;(l.material as THREE.Material).dispose()
}

function CameraRig({ reducedMotion, registry }: { reducedMotion: boolean; registry: RefObject<Registry> }) {
  const { camera, gl } = useThree()
  const controls = useRef<OrbitControls | null>(null)
  const goal = useRef<{ target: THREE.Vector3; cam: THREE.Vector3 } | null>(null)
  const follow = useRef<string | null>(null)
  const focusNonce = useUi((s) => s.focusNonce)
  const focusTarget = useUi((s) => s.focusTarget)

  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement)
    c.enableDamping = !reducedMotion
    c.dampingFactor = 0.08
    c.minDistance = 4
    c.maxDistance = 900
    c.target.copy(HOME.target)
    camera.position.copy(HOME.cam)
    // Any manual interaction cancels an in-flight transition and stops following.
    const stop = () => {
      goal.current = null
      follow.current = null
    }
    c.addEventListener('start', stop)
    controls.current = c
    return () => {
      c.removeEventListener('start', stop)
      c.dispose()
    }
  }, [camera, gl, reducedMotion])

  useEffect(() => {
    if (focusNonce === 0) return
    const { selectedShipId, selectedNodeId } = useUi.getState()
    const id = selectedShipId ?? selectedNodeId
    if (focusTarget === 'home' || !id) {
      follow.current = null
      goal.current = { target: HOME.target.clone(), cam: HOME.cam.clone() }
      return
    }
    follow.current = id
    const obj = registry.current?.get(id)
    const target = obj ? obj.position.clone() : HOME.target.clone()
    goal.current = { target, cam: target.clone().add(new THREE.Vector3(0, 26, 22)) }
  }, [focusNonce, focusTarget, registry])

  useFrame(() => {
    const c = controls.current
    if (!c) return
    const followed = follow.current ? registry.current?.get(follow.current) : undefined
    const g = goal.current
    if (g) {
      if (followed) {
        const offset = g.cam.clone().sub(g.target)
        g.target.copy(followed.position)
        g.cam.copy(followed.position).add(offset)
      }
      const k = reducedMotion ? 1 : 0.09
      c.target.lerp(g.target, k)
      camera.position.lerp(g.cam, k)
      if (camera.position.distanceTo(g.cam) < 0.05) goal.current = null
    } else if (followed) {
      // Keep the followed object centred while preserving the user's zoom/orbit offset.
      const delta = followed.position.clone().sub(c.target)
      c.target.add(delta)
      camera.position.add(delta)
    }
    c.update()
  })
  return null
}

function Orbits({ colors }: { colors: SceneColors }) {
  const lines = useMemo(
    () =>
      BODIES.filter((b) => b.a > 0).map((b) => {
        const r = displayRadius(b.a)
        const pts = Array.from({ length: 161 }, (_, i) => {
          const a = (i / 160) * Math.PI * 2
          return new THREE.Vector3(Math.cos(a) * r, 0, -Math.sin(a) * r)
        })
        return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: colors.orbit }))
      }),
    [colors.orbit],
  )
  useEffect(() => () => lines.forEach(disposeLine), [lines])
  return (
    <>
      {lines.map((l, i) => (
        <primitive key={i} object={l} />
      ))}
    </>
  )
}

function Stars() {
  const points = useMemo(() => {
    const n = 1400
    const pos = new Float32Array(n * 3)
    let s = 7
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < n; i++) {
      const u = r() * 2 - 1
      const th = r() * Math.PI * 2
      const R = 1400 + r() * 600
      const q = Math.sqrt(1 - u * u)
      pos.set([R * q * Math.cos(th), R * u, R * q * Math.sin(th)], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return new THREE.Points(g, new THREE.PointsMaterial({ color: '#9fb4d6', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.7 }))
  }, [])
  useEffect(
    () => () => {
      points.geometry.dispose()
      ;(points.material as THREE.Material).dispose()
    },
    [points],
  )
  return <primitive object={points} />
}

function Bodies({ time, segments }: { time: number; segments: number }) {
  return (
    <>
      {BODIES.map((b) => {
        const p = worldOf(bodyPosition(b.id, time))
        return (
          <mesh key={b.id} position={p}>
            <sphereGeometry args={[b.displayRadius, segments, Math.round(segments / 2)]} />
            {b.id === 'sun' ? <meshBasicMaterial color={b.color} /> : <meshStandardMaterial color={b.color} roughness={0.9} emissive={b.color} emissiveIntensity={0.15} />}
          </mesh>
        )
      })}
      {/* Saturn's ring, for recognisability */}
      <mesh position={worldOf(bodyPosition('saturn', time))} rotation={[-Math.PI / 2.3, 0, 0]}>
        <ringGeometry args={[5.4, 7.6, segments]} />
        <meshBasicMaterial color="#cdb980" transparent opacity={0.45} side={THREE.DoubleSide} />
      </mesh>
    </>
  )
}

const pointer = {
  over: (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    document.body.style.cursor = 'pointer'
  },
  out: () => {
    document.body.style.cursor = ''
  },
}

function Nodes({ time, colors, register }: { time: number; colors: SceneColors; register: (id: string, o: THREE.Object3D | null) => void }) {
  const selectedNodeId = useUi((s) => s.selectedNodeId)
  const selectNode = useUi((s) => s.selectNode)
  const outages = useSim((s) => s.sim.relayOutages)
  return (
    <>
      {NODES.map((n) => {
        const p = worldOf(nodePosition(n.id, time), 0.6)
        const up = n.kind === 'port' || relayOperational({ relayOutages: outages }, n.id, time)
        const color = n.kind === 'port' ? colors.port : up ? colors.relay : colors.relayDown
        return (
          <group key={n.id} position={p} ref={(o) => register(n.id, o)}>
            <mesh
              onClick={(e) => {
                e.stopPropagation()
                selectNode(n.id)
              }}
              onPointerOver={pointer.over}
              onPointerOut={pointer.out}
            >
              {n.kind === 'port' ? <octahedronGeometry args={[1.3]} /> : <tetrahedronGeometry args={[0.9]} />}
              <meshBasicMaterial color={color} wireframe={n.kind === 'relay'} />
            </mesh>
            {selectedNodeId === n.id && (
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[2.4, 2.8, 40]} />
                <meshBasicMaterial color={colors.selected} side={THREE.DoubleSide} />
              </mesh>
            )}
          </group>
        )
      })}
    </>
  )
}

const N_TRACK = 160
const legsKey = (s: Ship) => s.legs.map((l) => `${l.t0}:${l.t1}:${l.p1.x.toFixed(6)}`).join('|')

/** Planned path sampled uniformly in time; the flown part is solid, the projected part dashed. */
function TrajectoryPath({ ship, colors, emphasis }: { ship: Ship; colors: SceneColors; emphasis: boolean }) {
  const key = legsKey(ship)
  const { flown, ahead, dep, arr } = useMemo(() => {
    const dep = departureTime(ship)
    const arr = arrivalTime(ship)
    const pts = Array.from({ length: N_TRACK + 1 }, (_, i) => worldOf(shipPosition(ship, dep + ((arr - dep) * i) / N_TRACK), 0.3))
    const flown = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: emphasis ? colors.selected : colors.routeFlown, transparent: true, opacity: emphasis ? 0.55 : 0.5 }),
    )
    const ahead = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineDashedMaterial({ color: emphasis ? colors.selected : colors.route, dashSize: emphasis ? 1.6 : 1.2, gapSize: 1, transparent: true, opacity: emphasis ? 1 : 0.55 }),
    )
    ahead.computeLineDistances()
    return { flown, ahead, dep, arr }
    // Geometry depends only on the route (key), not on the per-tick ship object.
  }, [key, emphasis, colors])
  useEffect(
    () => () => {
      disposeLine(flown)
      disposeLine(ahead)
    },
    [flown, ahead],
  )
  useFrame(() => {
    const t = liveSimTime()
    const idx = Math.max(0, Math.min(N_TRACK, Math.round(((t - dep) / (arr - dep)) * N_TRACK)))
    flown.geometry.setDrawRange(0, idx + 1)
    ahead.geometry.setDrawRange(idx, N_TRACK + 1 - idx)
  })
  return (
    <>
      <primitive object={flown} />
      <primitive object={ahead} />
    </>
  )
}

function SpacecraftMarker({ ship, color, selected, colors, register }: { ship: Ship; color: string; selected: boolean; colors: SceneColors; register: (id: string, o: THREE.Object3D | null) => void }) {
  const selectShip = useUi((s) => s.selectShip)
  return (
    <group ref={(o) => register(ship.id, o)} userData={{ ship: true }}>
      <group name="hull">
        <mesh rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.55, 1.8, 10]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>
      {/* Generous invisible hit area for touch */}
      <mesh
        onClick={(e) => {
          e.stopPropagation()
          selectShip(ship.id)
        }}
        onPointerOver={pointer.over}
        onPointerOut={pointer.out}
      >
        <sphereGeometry args={[1.8, 8, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.7, 2.05, 36]} />
          <meshBasicMaterial color={colors.selected} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
}

/** Moves all markers every frame from analytic positions; scales them to stay readable at any zoom. */
function MarkerDriver({ registry, labels, nodeIds }: { registry: RefObject<Registry>; labels: RefObject<Map<string, HTMLElement>>; nodeIds: string[] }) {
  const { camera, size } = useThree()
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const t = liveSimTime()
    const ships = useSim.getState().sim.ships
    const reg = registry.current
    if (!reg) return
    for (const s of ships) {
      const g = reg.get(s.id)
      if (!g) continue
      const p = shipPosition(s, t)
      g.position.copy(worldOf(p, 0.8))
      const vel = shipVelocity(s, t)
      if (vel.x || vel.y) {
        const ahead = toDisplay({ x: p.x + vel.x * 1e-7, y: p.y + vel.y * 1e-7 })
        const here = toDisplay(p)
        g.getObjectByName('hull')!.rotation.y = Math.atan2(ahead.y - here.y, ahead.x - here.x)
      }
      const scale = Math.min(2.2, Math.max(0.12, camera.position.distanceTo(g.position) * 0.011))
      g.scale.setScalar(scale)
    }
    for (const id of nodeIds) {
      const g = reg.get(id)
      if (g) g.scale.setScalar(Math.min(1.8, Math.max(0.15, camera.position.distanceTo(g.position) * 0.01)))
    }
    // Project label anchors to screen space.
    const lab = labels.current
    if (!lab) return
    for (const [id, el] of lab) {
      const g = reg.get(id)
      if (!g) continue
      v.copy(g.position).project(camera)
      const hidden = v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1
      el.style.visibility = hidden ? 'hidden' : 'visible'
      if (!hidden) el.style.transform = `translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px)`
    }
  })
  return null
}

function ConflictMarkers({ conflicts, ships, colors, reducedMotion }: { conflicts: Conflict[]; ships: Ship[]; colors: SceneColors; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null)
  useFrame(({ clock, camera }) => {
    if (!group.current) return
    const pulse = reducedMotion ? 1 : 1 + 0.18 * Math.sin(clock.elapsedTime * 3)
    group.current.children.forEach((c) => c.scale.setScalar(pulse * Math.min(2.4, Math.max(0.12, camera.position.distanceTo(c.position) * 0.011))))
  })
  return (
    <group ref={group}>
      {conflicts.map((c) => {
        const a = ships.find((s) => s.id === c.a)
        const b = ships.find((s) => s.id === c.b)
        if (!a || !b) return null
        const pa = shipPosition(a, c.tca)
        const pb = shipPosition(b, c.tca)
        const mid = worldOf({ x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 }, 0.5)
        return (
          <mesh key={c.id} position={mid} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.2, 1.55, 32]} />
            <meshBasicMaterial color={colors.risk[c.severity]} side={THREE.DoubleSide} transparent opacity={0.9} />
          </mesh>
        )
      })}
    </group>
  )
}

function Scene({ colors, quality, reducedMotion, registry, labels }: { colors: SceneColors; quality: 'low' | 'high'; reducedMotion: boolean; registry: RefObject<Registry>; labels: RefObject<Map<string, HTMLElement>> }) {
  const sim = useSim((s) => s.sim)
  const selectedShipId = useUi((s) => s.selectedShipId)
  const overlays = useUi((s) => s.overlays)
  const views = fleetViews(sim)
  const riskById = useMemo(() => new Map<string, RiskLevel>(views.map((v) => [v.ship.id, v.risk])), [views])
  const register = (id: string, o: THREE.Object3D | null) => {
    if (o) registry.current?.set(id, o)
    else registry.current?.delete(id)
  }
  const segments = quality === 'low' ? 16 : 32
  const nodeIds = useMemo(() => NODES.map((n) => n.id), [])

  return (
    <>
      <color attach="background" args={[colors.bg]} />
      <ambientLight intensity={0.55} />
      <pointLight position={[0, 0, 0]} intensity={2.2} decay={0} color="#fff1d6" />
      {quality === 'high' && <Stars />}
      <Orbits colors={colors} />
      <Bodies time={sim.time} segments={segments} />
      <Nodes time={sim.time} colors={colors} register={register} />
      {sim.ships.map((s) =>
        overlays.trajectories || s.id === selectedShipId ? (
          <TrajectoryPath key={`tr-${s.id}`} ship={s} colors={colors} emphasis={s.id === selectedShipId} />
        ) : null,
      )}
      {sim.ships.map((s) => (
        <SpacecraftMarker key={s.id} ship={s} color={colors.risk[riskById.get(s.id) ?? 'unknown']} selected={s.id === selectedShipId} colors={colors} register={register} />
      ))}
      <ConflictMarkers conflicts={sim.conflicts} ships={sim.ships} colors={colors} reducedMotion={reducedMotion} />
      <MarkerDriver registry={registry} labels={labels} nodeIds={nodeIds} />
      <CameraRig reducedMotion={reducedMotion} registry={registry} />
    </>
  )
}

/** Screen-space labels for ships and ports, positioned by MarkerDriver without React re-renders. */
function Labels({ labels }: { labels: RefObject<Map<string, HTMLElement>> }) {
  const { num, t } = usePrefs()
  const sim = useSim((s) => s.sim)
  const overlays = useUi((s) => s.overlays)
  const selectedShipId = useUi((s) => s.selectedShipId)
  if (!overlays.labels) return null
  const views = fleetViews(sim)
  const ref = (id: string) => (el: HTMLElement | null) => {
    if (el) labels.current?.set(id, el)
    else labels.current?.delete(id)
  }
  return (
    <div className="scene-labels" aria-hidden>
      {NODES.filter((n) => n.kind === 'port').map((n) => (
        <span key={n.id} ref={ref(n.id)} className="scene-label node">
          {n.name}
        </span>
      ))}
      {views.map((v) => (
        <span key={v.ship.id} ref={ref(v.ship.id)} className={`scene-label ship risk-${v.risk}${v.ship.id === selectedShipId ? ' selected' : ''}`}>
          {v.ship.id}
          {overlays.telemetry && v.status === 'in_transit' && <small>{t('common.kms', { n: num(v.speedKms) })}</small>}
        </span>
      ))}
    </div>
  )
}

export interface SpaceSceneProps {
  quality: 'low' | 'high'
  onContextLost: () => void
}

export default function SpaceScene({ quality, onContextLost }: SpaceSceneProps) {
  const { theme, reducedMotion } = usePrefs()
  const colors = useMemo(() => sceneColors(theme), [theme])
  const registry = useRef<Registry>(new Map())
  const labels = useRef<Map<string, HTMLElement>>(new Map())
  const [ready, setReady] = useState(false)
  // R3F forces a context loss when it unmounts; only a loss while mounted means the device failed.
  const mounted = useRef(true)
  useLayoutEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  return (
    <div className="scene" dir="ltr">
      <Canvas
        camera={{ position: HOME.cam.toArray(), fov: 45, near: 0.5, far: 5000 }}
        dpr={quality === 'low' ? 1 : [1, 1.75]}
        gl={{ antialias: quality === 'high', powerPreference: quality === 'low' ? 'low-power' : 'high-performance' }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault()
            if (mounted.current) onContextLost()
          })
          setReady(true)
        }}
        onPointerMissed={() => (document.body.style.cursor = '')}
      >
        <Scene colors={colors} quality={quality} reducedMotion={reducedMotion} registry={registry} labels={labels} />
      </Canvas>
      {ready && <Labels labels={labels} />}
    </div>
  )
}
