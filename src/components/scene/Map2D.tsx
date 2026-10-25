import { Minus, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { BODIES } from '../../data/bodies'
import { NODE_BY_ID, NODES } from '../../data/nodes'
import { usePrefs } from '../../context/PreferencesContext'
import { relayOperational } from '../../sim/comms'
import { bodyPosition, nodePosition } from '../../sim/orbits'
import { fleetViews } from '../../sim/selectors'
import { arrivalTime, departureTime, shipPosition } from '../../sim/trajectory'
import { useSim } from '../../store/simStore'
import { useUi } from '../../store/uiStore'
import type { Ship, Vec2 } from '../../types'
import { displayRadius, sceneColors, toDisplay } from './projection'

const HOME_W = 330
const d = (au: Vec2) => {
  const p = toDisplay(au)
  return { x: p.x, y: -p.y }
}

function pathFor(ship: Ship, from: number, to: number, n = 48) {
  if (to <= from) return ''
  let out = ''
  for (let i = 0; i <= n; i++) {
    const p = d(shipPosition(ship, from + ((to - from) * i) / n))
    out += `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`
  }
  return out
}

/** Top-down 2D map. Same projection as the 3D view; ships are keyboard-focusable buttons. */
export function Map2D() {
  const { theme, t, num } = usePrefs()
  const colors = useMemo(() => sceneColors(theme), [theme])
  const sim = useSim((s) => s.sim)
  const { selectedShipId, selectedNodeId, selectShip, selectNode, overlays, focusNonce, focusTarget } = useUi()
  const views = fleetViews(sim)
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [view, setView] = useState({ cx: 0, cy: 0, w: HOME_W })
  const drag = useRef<{ x: number; y: number; pointers: Map<number, { x: number; y: number }>; pinch?: number }>({ x: 0, y: 0, pointers: new Map() })

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width || 1, h: e.contentRect.height || 1 }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (focusNonce === 0) return
    const ui = useUi.getState()
    const s = useSim.getState().sim
    if (focusTarget === 'home') return setView({ cx: 0, cy: 0, w: HOME_W })
    const ship = s.ships.find((x) => x.id === ui.selectedShipId)
    const p = ship ? d(shipPosition(ship, s.time)) : ui.selectedNodeId ? d(nodePosition(ui.selectedNodeId, s.time)) : null
    if (p) setView({ cx: p.x, cy: p.y, w: 50 })
  }, [focusNonce, focusTarget])

  const h = (view.w * size.h) / size.w
  const unit = view.w / size.w // world units per pixel
  const zoomBy = (k: number, ax = view.cx, ay = view.cy) =>
    setView((v) => {
      const w = Math.min(900, Math.max(6, v.w * k))
      const f = w / v.w
      return { w, cx: ax + (v.cx - ax) * f, cy: ay + (v.cy - ay) * f }
    })

  const onDown = (e: RPointerEvent) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    drag.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    drag.current.x = e.clientX
    drag.current.y = e.clientY
  }
  const onMove = (e: RPointerEvent) => {
    const st = drag.current
    if (!st.pointers.has(e.pointerId)) return
    st.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (st.pointers.size === 2) {
      const [a, b] = [...st.pointers.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      if (st.pinch) zoomBy(st.pinch / dist)
      st.pinch = dist
      return
    }
    const dx = e.clientX - st.x
    const dy = e.clientY - st.y
    st.x = e.clientX
    st.y = e.clientY
    setView((v) => ({ ...v, cx: v.cx - dx * unit, cy: v.cy - dy * unit }))
  }
  const onUp = (e: RPointerEvent) => {
    drag.current.pointers.delete(e.pointerId)
    if (drag.current.pointers.size < 2) drag.current.pinch = undefined
  }

  useEffect(() => {
    const el = box.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const ax = view.cx + (e.clientX - r.left - r.width / 2) * unit
      const ay = view.cy + (e.clientY - r.top - r.height / 2) * unit
      zoomBy(e.deltaY > 0 ? 1.15 : 1 / 1.15, ax, ay)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  const fs = Math.max(0.5, unit * 11)
  const shipSize = unit * 9
  const now = sim.time

  return (
    <div className="map2d" ref={box} dir="ltr">
      <svg
        viewBox={`${view.cx - view.w / 2} ${view.cy - h / 2} ${view.w} ${h}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{ background: colors.bg }}
        aria-label={t('dash.mapAria')}
        role="group"
      >
        {BODIES.filter((b) => b.a > 0).map((b) => (
          <circle key={`o-${b.id}`} r={displayRadius(b.a)} fill="none" stroke={colors.orbit} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        {BODIES.map((b) => {
          const p = d(bodyPosition(b.id, now))
          return <circle key={b.id} cx={p.x} cy={p.y} r={Math.max(b.displayRadius * 0.6, unit * 3)} fill={b.color} />
        })}
        {sim.ships.map((s) => {
          const sel = s.id === selectedShipId
          if (!overlays.trajectories && !sel) return null
          const dep = departureTime(s)
          const arr = arrivalTime(s)
          if (arr <= now && !sel) return null
          const cut = Math.min(Math.max(now, dep), arr)
          return (
            <g key={`r-${s.id}`} fill="none" vectorEffect="non-scaling-stroke">
              <path d={pathFor(s, dep, cut)} stroke={sel ? colors.selected : colors.routeFlown} strokeWidth={sel ? 2 : 1} opacity={0.6} vectorEffect="non-scaling-stroke" />
              <path d={pathFor(s, cut, arr)} stroke={sel ? colors.selected : colors.route} strokeWidth={sel ? 2 : 1} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" opacity={sel ? 1 : 0.7} />
            </g>
          )
        })}
        {sim.conflicts.map((c) => {
          const a = sim.ships.find((s) => s.id === c.a)
          const b = sim.ships.find((s) => s.id === c.b)
          if (!a || !b) return null
          const pa = d(shipPosition(a, c.tca))
          const pb = d(shipPosition(b, c.tca))
          return <circle key={c.id} cx={(pa.x + pb.x) / 2} cy={(pa.y + pb.y) / 2} r={unit * 10} fill="none" stroke={colors.risk[c.severity]} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        })}
        {NODES.map((n) => {
          const p = d(nodePosition(n.id, now))
          const up = n.kind === 'port' || relayOperational(sim, n.id, now)
          const r = unit * 6
          const color = n.kind === 'port' ? colors.port : up ? colors.relay : colors.relayDown
          return (
            <g
              key={n.id}
              transform={`translate(${p.x},${p.y})`}
              role="button"
              tabIndex={0}
              aria-label={n.name}
              aria-pressed={selectedNodeId === n.id}
              className="map-node"
              onClick={() => selectNode(n.id)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), selectNode(n.id))}
            >
              {n.kind === 'port' ? <rect x={-r / 1.4} y={-r / 1.4} width={r * 1.41} height={r * 1.41} transform="rotate(45)" fill={color} /> : <path d={`M0,${-r} L${r},${r * 0.8} L${-r},${r * 0.8}Z`} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />}
              {selectedNodeId === n.id && <circle r={r * 1.9} fill="none" stroke={colors.selected} strokeWidth={2} vectorEffect="non-scaling-stroke" />}
              {overlays.labels && n.kind === 'port' && (
                <text x={r * 1.5} y={r * 0.5} fontSize={fs} fill={colors.label} opacity={0.75}>
                  {n.name}
                </text>
              )}
            </g>
          )
        })}
        {views.map((v) => {
          if (v.status === 'docked' && v.ship.id !== selectedShipId) return null
          const p = d(v.pos)
          const sel = v.ship.id === selectedShipId
          const color = colors.risk[v.risk]
          return (
            <g
              key={v.ship.id}
              transform={`translate(${p.x},${p.y})`}
              role="button"
              tabIndex={0}
              aria-label={`${v.ship.id} ${v.ship.name}, ${t(`risk.${v.risk}`)}`}
              aria-pressed={sel}
              className="map-ship"
              onClick={() => selectShip(v.ship.id)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), selectShip(v.ship.id))}
            >
              <circle r={shipSize * 1.6} fill="transparent" />
              <path d={`M${shipSize},0 L${-shipSize * 0.7},${shipSize * 0.6} L${-shipSize * 0.35},0 L${-shipSize * 0.7},${-shipSize * 0.6}Z`} fill={color} transform={`rotate(${-v.heading})`} />
              {sel && <circle r={shipSize * 1.8} fill="none" stroke={colors.selected} strokeWidth={2} vectorEffect="non-scaling-stroke" />}
              {overlays.labels && (
                <text x={shipSize * 1.6} y={-shipSize * 0.6} fontSize={fs} fill={sel ? colors.selected : colors.label} fontFamily="var(--mono)">
                  {v.ship.id}
                  {overlays.telemetry && v.status === 'in_transit' ? ` · ${num(v.speedKms)} km/s` : ''}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <div className="zoom-btns">
        <button className="icon-btn sm" onClick={() => zoomBy(1 / 1.4)} aria-label={t('dash.zoomIn')}>
          <Plus size={16} />
        </button>
        <button className="icon-btn sm" onClick={() => zoomBy(1.4)} aria-label={t('dash.zoomOut')}>
          <Minus size={16} />
        </button>
      </div>
      {selectedNodeId && NODE_BY_ID[selectedNodeId] && <span className="sr-only">{NODE_BY_ID[selectedNodeId].name}</span>}
    </div>
  )
}
