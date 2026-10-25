import { Box, Crosshair, Eye, Home, List, Map as MapIcon, Route, Tag, X } from 'lucide-react'
import { lazy, Suspense, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Map2D } from '../components/scene/Map2D'
import { RiskBadge, SimBadge } from '../components/common/ui'
import { ShipFilters } from '../components/ships/ShipFilters'
import { applyFilters } from '../components/ships/filtering'
import { NodePanel, ShipDetailsPanel } from '../components/ships/ShipDetailsPanel'
import { ShipList } from '../components/ships/ShipList'
import { usePrefs } from '../context/PreferencesContext'
import { useIsMobile } from '../hooks/useMediaQuery'
import { hasWebGL } from '../hooks/useWebGL'
import { fleetViews } from '../sim/selectors'
import { useSim } from '../store/simStore'
import { useUi } from '../store/uiStore'

const SpaceScene = lazy(() => import('../components/scene/SpaceScene'))

function FleetSummary() {
  const { t, num } = usePrefs()
  const sim = useSim((s) => s.sim)
  const views = fleetViews(sim)
  const count = (st: string) => views.filter((v) => v.status === st).length
  const crit = views.filter((v) => v.risk === 'crit').length
  const conflicts = sim.conflicts
  return (
    <div className="float-panel summary" aria-label={t('dash.fleet')}>
      <div className="stat">
        <span className="stat-v">{num(count('in_transit'))}</span>
        <span className="stat-l">{t('dash.inTransit')}</span>
      </div>
      <div className="stat">
        <span className="stat-v">{num(count('scheduled'))}</span>
        <span className="stat-l">{t('dash.scheduled')}</span>
      </div>
      <div className="stat">
        <span className="stat-v">{num(count('docked'))}</span>
        <span className="stat-l">{t('dash.docked')}</span>
      </div>
      <Link to="/traffic" className={`stat link ${conflicts.length ? (conflicts.some((c) => c.severity === 'crit') ? 'risk-crit' : 'risk-warn') : ''}`}>
        <span className="stat-v">{num(conflicts.length)}</span>
        <span className="stat-l">{t('dash.conflicts')}</span>
      </Link>
      <div className={`stat ${crit ? 'risk-crit' : ''}`}>
        <span className="stat-v">{num(crit)}</span>
        <span className="stat-l">{t('dash.criticalAlerts')}</span>
      </div>
    </div>
  )
}

function ConflictTicker() {
  const { t, num, dur } = usePrefs()
  const sim = useSim((s) => s.sim)
  const selectShip = useUi((s) => s.selectShip)
  if (!sim.conflicts.length) return null
  return (
    <div className="float-panel ticker">
      <ul>
        {sim.conflicts.slice(0, 3).map((c) => (
          <li key={c.id}>
            <RiskBadge level={c.severity} compact />
            <button className="link-btn mono" onClick={() => selectShip(c.a, true)}>
              {c.a}
            </button>
            /
            <button className="link-btn mono" onClick={() => selectShip(c.b, true)}>
              {c.b}
            </button>
            <span className="muted">
              {t('common.km', { n: num(c.minSepKm) })} · {t('common.in', { t: dur(c.tca - sim.time) })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function DashboardPage() {
  const { t, quality, reducedMotion } = usePrefs()
  const sim = useSim((s) => s.sim)
  const { view, setView, overlays, toggleOverlay, filters, selectedShipId, selectedNodeId, selectShip, selectNode, focus } = useUi()
  const isMobile = useIsMobile()
  const [listOpen, setListOpen] = useState(false)
  const [glFailed, setGlFailed] = useState(() => !hasWebGL())
  const views = useMemo(() => applyFilters(fleetViews(sim), filters), [sim, filters])
  const lowPower = quality === 'low' || (quality === 'auto' && (isMobile || reducedMotion || (navigator.hardwareConcurrency ?? 8) <= 4))
  const use3d = view === '3d' && !glFailed

  const overlayBtn = (k: keyof typeof overlays, Icon: typeof Eye, label: string) => (
    <button className={`tool-btn${overlays[k] ? ' on' : ''}`} aria-pressed={overlays[k]} onClick={() => toggleOverlay(k)} title={label}>
      <Icon size={15} aria-hidden /> <span className="tool-label">{label}</span>
    </button>
  )

  return (
    <div className={`dash${selectedShipId || selectedNodeId ? ' has-inspector' : ''}`}>
      <aside className={`dash-list${listOpen ? ' open' : ''}`} aria-label={t('dash.shipList')}>
        <div className="dash-list-head">
          <h2>
            {t('dash.fleet')} <span className="muted small">{t('filter.count', { n: views.length, total: sim.ships.length })}</span>
          </h2>
          <button className="icon-btn only-mobile" onClick={() => setListOpen(false)} aria-label={t('common.close')}>
            <X size={18} />
          </button>
        </div>
        <ShipFilters compact />
        <ShipList views={views} onPick={() => isMobile && setListOpen(false)} />
      </aside>

      <section className="viewport" aria-label={t('dash.mapAria')}>
        {use3d ? (
          <Suspense fallback={<div className="scene-loading">{t('dash.loadingScene')}</div>}>
            <SpaceScene quality={lowPower ? 'low' : 'high'} onContextLost={() => setGlFailed(true)} />
          </Suspense>
        ) : (
          <Map2D />
        )}

        <div className="toolbar" role="toolbar" aria-label={t('dash.viewLabel')}>
          <div className="seg" role="group" aria-label={t('dash.viewLabel')}>
            <button className={use3d ? 'on' : ''} aria-pressed={use3d} onClick={() => setView('3d')} disabled={glFailed}>
              <Box size={15} aria-hidden /> {t('dash.view3d')}
            </button>
            <button className={!use3d ? 'on' : ''} aria-pressed={!use3d} onClick={() => setView('2d')}>
              <MapIcon size={15} aria-hidden /> {t('dash.view2d')}
            </button>
          </div>
          <button className="tool-btn" onClick={() => focus('home')} title={t('dash.resetCamera')}>
            <Home size={15} aria-hidden /> <span className="tool-label">{t('dash.resetCamera')}</span>
          </button>
          <button className="tool-btn" onClick={() => focus('selection')} disabled={!selectedShipId && !selectedNodeId} title={t('dash.focus')}>
            <Crosshair size={15} aria-hidden /> <span className="tool-label">{t('dash.focus')}</span>
          </button>
          {overlayBtn('trajectories', Route, t('dash.trajectories'))}
          {overlayBtn('labels', Tag, t('dash.labels'))}
          {overlayBtn('telemetry', Eye, t('dash.telemetry'))}
          <button className="tool-btn only-mobile" onClick={() => setListOpen(true)} aria-label={t('dash.openList')}>
            <List size={15} aria-hidden />
          </button>
        </div>

        {overlays.telemetry && (
          <div className="floats">
            <FleetSummary />
            <ConflictTicker />
          </div>
        )}

        <div className="viewport-foot">
          {glFailed && view === '3d' && <p className="notice gray">{t('dash.webgl')}</p>}
          <p className="hint hide-mobile">{use3d ? t('dash.hint') : t('dash.hint2d')}</p>
          <p className="disclaimer">
            <SimBadge /> {t('dash.notToScale')}
            {use3d && lowPower && <span className="muted"> · {t('dash.lowPower')}</span>}
          </p>
        </div>
      </section>

      {selectedShipId && <ShipDetailsPanel shipId={selectedShipId} onClose={() => selectShip(null)} />}
      {!selectedShipId && selectedNodeId && <NodePanel nodeId={selectedNodeId} onClose={() => selectNode(null)} />}
      {listOpen && <div className="scrim only-mobile" onClick={() => setListOpen(false)} />}
    </div>
  )
}
