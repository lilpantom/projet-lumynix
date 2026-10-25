import { ArrowRight, Info, Maximize2, Route, ShieldAlert, Wrench, X } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { NODE_BY_ID } from '../../data/nodes'
import { usePrefs } from '../../context/PreferencesContext'
import type { TranslationKey } from '../../i18n'
import { relayOperational } from '../../sim/comms'
import { worstApproach } from '../../sim/conflicts'
import { componentLevel, reasons as maintReasons } from '../../sim/maintenance'
import { nodePosition } from '../../sim/orbits'
import { dockingOccupancy } from '../../sim/routing'
import { fleetViews, type ShipView } from '../../sim/selectors'
import { useSim } from '../../store/simStore'
import { useUi } from '../../store/uiStore'
import type { RiskLevel, SimState } from '../../types'
import { eventText } from '../common/eventText'
import { Field, Meter, RiskBadge } from '../common/ui'

const fuelLevel = (f: number): RiskLevel => (f < 8 ? 'crit' : f < 15 ? 'warn' : 'ok')
const commLevel = { nominal: 'ok', degraded: 'warn', lost: 'unknown' } as const

export function TelemetryCard({ v }: { v: ShipView }) {
  const { t, num, dt, dur } = usePrefs()
  const stale = v.comm === 'lost'
  const r = Math.hypot(v.pos.x, v.pos.y)
  const lon = ((Math.atan2(v.pos.y, v.pos.x) * 180) / Math.PI + 360) % 360
  const val = (s: string) => (stale ? <span className="stale" title={t('common.unverified')}>{s}*</span> : s)
  return (
    <div className="telemetry">
      {stale && (
        <p className="notice gray" role="note">
          <Info size={14} aria-hidden /> {t('reason.comm_lost')}
        </p>
      )}
      <dl className="fields">
        <Field label={t('ship.status')} value={t(`mstatus.${v.status}`)} />
        <Field label={t('ship.position')} value={val(t('ship.posValue', { r: num(r, 3), lon: num(lon, 1) }))} />
        <Field label={t('ship.speed')} value={v.status === 'in_transit' ? val(t('common.kms', { n: num(v.speedKms, 1) })) : '—'} mono />
        <Field label={t('ship.heading')} value={v.status === 'in_transit' ? val(`${num(v.heading, 1)}°`) : '—'} mono />
        <Field label={t('ship.eta')} value={v.status === 'docked' ? '—' : dt(v.eta)} />
        <Field label={t('ship.travelTime')} value={v.status === 'docked' ? '—' : dur(v.remainingMs)} />
        <Field label={t('ship.distance')} value={v.status === 'docked' ? '—' : `${num(v.remainingAu, 3)} AU`} mono />
        <Field label={t('ship.commDelay')} value={t('common.min', { n: num(v.commDelayMin, 1) })} mono />
        <Field label={t('ship.comm')} value={<RiskBadge level={commLevel[v.comm]} label={t(`comm.${v.comm}`)} />} />
        <Field label={t('ship.maintenance')} value={<RiskBadge level={v.maintLevel} label={t(`avail.${v.availability}`)} />} />
      </dl>
      <div className="fuel-row">
        <span>{t('ship.fuel')}</span>
        <Meter value={v.ship.fuel} level={fuelLevel(v.ship.fuel)} label={t('ship.fuel')} />
        <span className="mono">{t('common.percent', { n: num(v.ship.fuel, 1) })}</span>
      </div>
      <dl className="fields two">
        <Field label={t('ship.mission')} value={t(`mission.${v.ship.missionType}`)} />
        <Field label={t('ship.cargo')} value={t(`cargo.${v.ship.cargo}`)} />
        <Field label={t('ship.priority')} value={t(`priority.${v.ship.priority}`)} />
        <Field label={t('ship.crew')} value={num(v.ship.crewCount)} />
      </dl>
    </div>
  )
}

export function useShipHud(sim: SimState, shipId: string) {
  return useMemo(() => {
    const view = fleetViews(sim).find((v) => v.ship.id === shipId)
    if (!view) return null
    const conflicts = sim.conflicts.filter((c) => c.a === shipId || c.b === shipId)
    const closest = view.status === 'docked' ? null : worstApproach(view.ship, sim.ships, sim.time, sim.settings)
    const comps = sim.components.filter((c) => c.assetId === shipId)
    const warnings = comps.filter((c) => componentLevel(c, sim.time) !== 'ok').sort((a, b) => b.wear - a.wear)
    const events = sim.events.filter((e) => e.shipId === shipId).slice(0, 8)
    return { view, conflicts, closest, warnings, events }
  }, [sim, shipId])
}

export function Recommendations({ hud }: { hud: NonNullable<ReturnType<typeof useShipHud>> }) {
  const { t } = usePrefs()
  const { view, conflicts, warnings } = hud
  const items: { key: string; text: string; to?: string; level: RiskLevel }[] = []
  for (const c of conflicts) {
    const other = c.a === view.ship.id ? c.b : c.a
    items.push({ key: c.id, text: t('hud.rec.resolveConflict', { ship: other }), to: `/traffic?c=${encodeURIComponent(c.id)}`, level: c.severity })
  }
  if (view.reasons.includes('fuel_crit') || view.reasons.includes('fuel_warn')) items.push({ key: 'fuel', text: t('hud.rec.fuel'), level: view.reasons.includes('fuel_crit') ? 'crit' : 'warn' })
  if (view.comm === 'lost') items.push({ key: 'comm', text: t('hud.rec.comm'), level: 'unknown' })
  if (view.comm === 'degraded') items.push({ key: 'commd', text: t('hud.rec.commDegraded'), to: `/ships/${view.ship.id}#routes`, level: 'warn' })
  if (warnings[0]) items.push({ key: 'maint', text: t('hud.rec.maint', { component: t(`comp.${warnings[0].kind}`) }), to: '/maintenance', level: 'warn' })
  return (
    <div>
      {items.length === 0 ? (
        <p className="empty">{t('hud.noRecommendations')}</p>
      ) : (
        <ul className="rec-list">
          {items.map((i) => (
            <li key={i.key} className={`risk-border-${i.level}`}>
              <span>{i.text}</span>
              {i.to && (
                <Link to={i.to} className="icon-btn sm" aria-label={t('common.open')}>
                  <ArrowRight size={14} className="flip-rtl" />
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="disclaimer">
        <ShieldAlert size={13} aria-hidden /> {t('hud.decisionSupport')}
      </p>
    </div>
  )
}

export function HudBody({ hud }: { hud: NonNullable<ReturnType<typeof useShipHud>> }) {
  const prefs = usePrefs()
  const { t, num, dt, dur } = prefs
  const sim = useSim((s) => s.sim)
  const { view, conflicts, closest, warnings, events } = hud
  return (
    <div className="hud">
      <section className="hud-sec">
        <h3>{t('hud.legs')}</h3>
        <p className="route-line">
          <span>{NODE_BY_ID[view.ship.originId]?.name}</span>
          <ArrowRight size={14} className="flip-rtl" aria-hidden />
          {view.ship.legs
            .filter((l) => l.t1 > sim.time && l.viaNodeId && l.viaNodeId !== view.ship.destinationId)
            .map((l) => (
              <span key={l.viaNodeId} className="via">
                {NODE_BY_ID[l.viaNodeId!]?.name} <ArrowRight size={14} className="flip-rtl" aria-hidden />
              </span>
            ))}
          <span>{NODE_BY_ID[view.ship.destinationId]?.name}</span>
        </p>
        <p className="disclaimer">{t('hud.illustrative')}</p>
      </section>
      <section className="hud-sec">
        <h3>{t('hud.closest')}</h3>
        {closest ? (
          <p>
            <RiskBadge level={closest.minSepKm < sim.settings.thresholdKm ? (conflicts.find((c) => c.a === closest.otherId || c.b === closest.otherId)?.severity ?? 'warn') : 'ok'} compact />{' '}
            {t('hud.closestWith', { km: num(closest.minSepKm), ship: closest.otherId, when: t('common.in', { t: dur(closest.tca - sim.time) }) })}
          </p>
        ) : (
          <p className="empty">{t('hud.closestNone', { km: num(sim.settings.thresholdKm), h: sim.settings.horizonH })}</p>
        )}
      </section>
      <section className="hud-sec">
        <h3>{t('hud.conflicts')}</h3>
        {conflicts.length === 0 ? (
          <p className="empty">{t('hud.noConflicts')}</p>
        ) : (
          <ul className="mini-list">
            {conflicts.map((c) => (
              <li key={c.id}>
                <RiskBadge level={c.severity} />
                <span className="mono">{c.a === view.ship.id ? c.b : c.a}</span>
                <span>{t('common.km', { n: num(c.minSepKm) })}</span>
                <span className="muted">{dt(c.tca)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="hud-sec">
        <h3>{t('hud.recommendations')}</h3>
        <Recommendations hud={hud} />
      </section>
      <section className="hud-sec">
        <h3>
          <Wrench size={14} aria-hidden /> {t('hud.maintWarnings')}
        </h3>
        {warnings.length === 0 ? (
          <p className="empty">{t('hud.noMaint')}</p>
        ) : (
          <ul className="mini-list">
            {warnings.map((c) => (
              <li key={c.id}>
                <RiskBadge level={componentLevel(c, sim.time)} compact />
                <span>{t(`comp.${c.kind}`)}</span>
                <span className="muted small">{maintReasons(c, sim.time).map((r) => t(`maint.r.${r}` as TranslationKey, { wear: num(c.wear) })).join(' ')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="hud-sec">
        <h3>{t('hud.events')}</h3>
        {events.length === 0 ? (
          <p className="empty">{t('hud.noEvents')}</p>
        ) : (
          <ul className="event-list">
            {events.map((e) => (
              <li key={e.id}>
                <time className="muted mono small">{dt(e.at)}</time>
                <span>{eventText(e.key, e.params, prefs)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/** Inspector for the selected ship on the dashboard (side panel on desktop, bottom sheet on mobile). */
export function ShipDetailsPanel({ shipId, onClose }: { shipId: string; onClose: () => void }) {
  const { t } = usePrefs()
  const sim = useSim((s) => s.sim)
  const focus = useUi((s) => s.focus)
  const hud = useShipHud(sim, shipId)
  if (!hud) return null
  const { view } = hud
  return (
    <aside className="inspector" aria-label={`${t('hud.title')} ${view.ship.id}`}>
      <header className="inspector-head">
        <div>
          <h2 className="mono">{view.ship.id}</h2>
          <p className="muted">{view.ship.name}</p>
        </div>
        <RiskBadge level={view.risk} />
        <button className="icon-btn" onClick={onClose} aria-label={t('dash.closePanel')}>
          <X size={18} />
        </button>
      </header>
      {view.reasons.length > 0 && (
        <ul className="reason-chips">
          {view.reasons.map((r) => (
            <li key={r}>{t(`reason.${r}`)}</li>
          ))}
        </ul>
      )}
      <div className="inspector-actions">
        <button className="btn sm" onClick={() => focus('selection')}>
          {t('dash.focus')}
        </button>
        <Link className="btn sm" to={`/ships/${encodeURIComponent(view.ship.id)}`}>
          <Maximize2 size={14} aria-hidden /> {t('hud.openFull')}
        </Link>
        {view.status !== 'docked' && (
          <Link className="btn sm" to={`/ships/${encodeURIComponent(view.ship.id)}#routes`}>
            <Route size={14} aria-hidden /> {t('hud.planRoute')}
          </Link>
        )}
      </div>
      <div className="inspector-body">
        <TelemetryCard v={view} />
        <HudBody hud={hud} />
        <p className="muted small">{t('ship.crewNote')}</p>
      </div>
    </aside>
  )
}

export function NodePanel({ nodeId, onClose }: { nodeId: string; onClose: () => void }) {
  const { t, dt } = usePrefs()
  const sim = useSim((s) => s.sim)
  const selectShip = useUi((s) => s.selectShip)
  const node = NODE_BY_ID[nodeId]
  if (!node) return null
  const p = nodePosition(nodeId, sim.time)
  const inbound = fleetViews(sim).filter((v) => v.ship.destinationId === nodeId && v.status !== 'docked').sort((a, b) => a.eta - b.eta)
  const occupied = dockingOccupancy(sim.ships, nodeId, sim.time)
  const up = relayOperational(sim, nodeId, sim.time)
  return (
    <aside className="inspector" aria-label={node.name}>
      <header className="inspector-head">
        <div>
          <h2>{node.name}</h2>
          <p className="muted">{node.kind === 'port' ? t('dash.nodeSelected') : t('dash.relay')}</p>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label={t('dash.closePanel')}>
          <X size={18} />
        </button>
      </header>
      <div className="inspector-body">
        <dl className="fields">
          <Field label={t('ship.id')} value={node.id} mono />
          <Field label={t('ship.position')} value={t('ship.posValue', { r: Math.hypot(p.x, p.y).toFixed(3), lon: (((Math.atan2(p.y, p.x) * 180) / Math.PI + 360) % 360).toFixed(1) })} />
          {node.kind === 'port' ? (
            <Field label={t('ship.availability')} value={t('dash.berths', { used: occupied, total: node.berths })} />
          ) : (
            <Field label={t('ship.status')} value={up ? <RiskBadge level="ok" label={t('dash.relayUp')} /> : <RiskBadge level="warn" label={t('dash.relayDown', { t: dt(sim.relayOutages[nodeId]) })} />} />
          )}
        </dl>
        {node.kind === 'port' && (
          <section className="hud-sec">
            <h3>{t('ship.eta')}</h3>
            {inbound.length === 0 ? (
              <p className="empty">{t('common.none')}</p>
            ) : (
              <ul className="mini-list">
                {inbound.map((v) => (
                  <li key={v.ship.id}>
                    <button className="link-btn mono" onClick={() => selectShip(v.ship.id, true)}>
                      {v.ship.id}
                    </button>
                    <span className="muted">{dt(v.eta)}</span>
                    <RiskBadge level={v.risk} compact />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </aside>
  )
}

