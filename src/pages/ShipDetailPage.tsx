import { ArrowLeft, Map as MapIcon } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { TrendChart } from '../components/charts/Charts'
import { Panel, RiskBadge, SimBadge } from '../components/common/ui'
import { HudBody, TelemetryCard, useShipHud } from '../components/ships/ShipDetailsPanel'
import { RouteComparison } from '../components/traffic/RouteComparison'
import { usePrefs } from '../context/PreferencesContext'
import { useSim } from '../store/simStore'
import { useUi } from '../store/uiStore'

export default function ShipDetailPage() {
  const { shipId = '' } = useParams()
  const id = decodeURIComponent(shipId)
  const { t } = usePrefs()
  const sim = useSim((s) => s.sim)
  const selectShip = useUi((s) => s.selectShip)
  const navigate = useNavigate()
  const { hash } = useLocation()
  const hud = useShipHud(sim, id)

  useEffect(() => {
    if (hash === '#routes') document.getElementById('routes')?.scrollIntoView({ block: 'start' })
  }, [hash])

  if (!hud) {
    return (
      <div className="page">
        <p className="empty">{t('ship.notFound', { id })}</p>
        <Link className="btn" to="/ships">
          {t('common.back')}
        </Link>
      </div>
    )
  }
  const { view } = hud
  const samples = sim.telemetry[view.ship.id] ?? []

  return (
    <div className="page">
      <header className="page-head">
        <Link to="/ships" className="icon-btn" aria-label={t('common.back')}>
          <ArrowLeft size={18} className="flip-rtl" />
        </Link>
        <div>
          <h1>
            <span className="mono">{view.ship.id}</span> · {view.ship.name}
          </h1>
          <p className="muted">{t('hud.title')}</p>
        </div>
        <RiskBadge level={view.risk} />
        <SimBadge />
        <button
          className="btn"
          onClick={() => {
            selectShip(view.ship.id, true)
            navigate('/dashboard')
          }}
        >
          <MapIcon size={15} aria-hidden /> {t('nav.dashboard')}
        </button>
      </header>
      {view.reasons.length > 0 && (
        <ul className="reason-chips">
          {view.reasons.map((r) => (
            <li key={r}>{t(`reason.${r}`)}</li>
          ))}
        </ul>
      )}
      <div className="grid-2">
        <Panel title={t('dash.telemetry')} id="tel">
          <TelemetryCard v={view} />
          <p className="muted small">{t('ship.crewNote')}</p>
        </Panel>
        <Panel title={t('hud.trajectory')} id="traj">
          <HudBody hud={hud} />
        </Panel>
      </div>
      <Panel title={t('hud.history')} id="hist">
        <div className="charts-3">
          <TrendChart data={samples as unknown as Record<string, number>[]} dataKey="speedKms" label={t('ship.speed')} unit="km/s" />
          <TrendChart data={samples as unknown as Record<string, number>[]} dataKey="fuel" label={t('ship.fuel')} unit="%" color="var(--series-2)" domain={[0, 100]} />
          <TrendChart data={samples as unknown as Record<string, number>[]} dataKey="commDelayMin" label={t('ship.commDelay')} unit="min" color="var(--series-3)" />
        </div>
      </Panel>
      <Panel title={t('route.title')} id="routes-panel">
        <RouteComparison shipId={view.ship.id} />
      </Panel>
    </div>
  )
}
