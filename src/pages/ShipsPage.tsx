import { Pencil, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Meter, Panel, RiskBadge, SimBadge } from '../components/common/ui'
import { ShipFilters } from '../components/ships/ShipFilters'
import { ShipForm } from '../components/ships/ShipForm'
import { applyFilters } from '../components/ships/filtering'
import { NODE_BY_ID } from '../data/nodes'
import { usePrefs } from '../context/PreferencesContext'
import { fleetViews } from '../sim/selectors'
import { useSim } from '../store/simStore'
import { useUi } from '../store/uiStore'
import type { Ship } from '../types'

export default function ShipsPage() {
  const { t, dt, num } = usePrefs()
  const sim = useSim((s) => s.sim)
  const filters = useUi((s) => s.filters)
  const [editing, setEditing] = useState<Ship | 'new' | null>(null)
  const views = useMemo(() => applyFilters(fleetViews(sim), filters), [sim, filters])

  return (
    <div className="page">
      <header className="page-head">
        <h1>{t('ships.title')}</h1>
        <SimBadge />
        <button className="btn primary push" onClick={() => setEditing('new')}>
          <Plus size={16} aria-hidden /> {t('ships.add')}
        </button>
      </header>
      <Panel>
        <ShipFilters />
        <p className="muted small" aria-live="polite">{t('filter.count', { n: views.length, total: sim.ships.length })}</p>
        {views.length === 0 ? (
          <p className="empty">{sim.ships.length ? t('filter.noResults') : t('ships.empty')}</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{t('ship.id')}</th>
                  <th scope="col">{t('ship.name')}</th>
                  <th scope="col" className="hide-mobile">{t('ship.mission')}</th>
                  <th scope="col">{t('ship.destination')}</th>
                  <th scope="col" className="hide-mobile">{t('ship.status')}</th>
                  <th scope="col" className="hide-mobile">{t('ship.eta')}</th>
                  <th scope="col">{t('ship.fuel')}</th>
                  <th scope="col">{t('ship.risk')}</th>
                  <th scope="col"><span className="sr-only">{t('common.edit')}</span></th>
                </tr>
              </thead>
              <tbody>
                {views.map((v) => (
                  <tr key={v.ship.id}>
                    <th scope="row">
                      <Link to={`/ships/${encodeURIComponent(v.ship.id)}`} className="mono">{v.ship.id}</Link>
                    </th>
                    <td>{v.ship.name}</td>
                    <td className="hide-mobile">{t(`mission.${v.ship.missionType}`)}</td>
                    <td>{NODE_BY_ID[v.ship.destinationId]?.name}</td>
                    <td className="hide-mobile">{t(`mstatus.${v.status}`)}</td>
                    <td className="hide-mobile">{v.status === 'docked' ? '—' : dt(v.eta)}</td>
                    <td>
                      <div className="fuel-cell">
                        <Meter value={v.ship.fuel} level={v.ship.fuel < 8 ? 'crit' : v.ship.fuel < 15 ? 'warn' : 'ok'} label={t('ship.fuel')} />
                        <span className="mono small">{num(v.ship.fuel)}%</span>
                      </div>
                    </td>
                    <td><RiskBadge level={v.risk} /></td>
                    <td>
                      <button className="icon-btn sm" onClick={() => setEditing(v.ship)} aria-label={`${t('common.edit')} ${v.ship.id}`}>
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {editing && <ShipForm ship={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
