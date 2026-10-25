import { Rocket } from 'lucide-react'
import { NODE_BY_ID } from '../../data/nodes'
import { usePrefs } from '../../context/PreferencesContext'
import type { ShipView } from '../../sim/selectors'
import { useSim } from '../../store/simStore'
import { useUi } from '../../store/uiStore'
import { Meter, RiskBadge } from '../common/ui'

const fuelLevel = (f: number) => (f < 8 ? 'crit' : f < 15 ? 'warn' : 'ok')

/** Compact, keyboard-navigable list. Selection is mirrored on the map. */
export function ShipList({ views, onPick }: { views: ShipView[]; onPick?: (id: string) => void }) {
  const { t, dur, num } = usePrefs()
  const selected = useUi((s) => s.selectedShipId)
  const now = useSim((s) => s.sim.time)
  const selectShip = useUi((s) => s.selectShip)
  if (!views.length) return <p className="empty">{t('filter.noResults')}</p>
  return (
    <ul className="ship-list" aria-label={t('dash.shipList')}>
      {views.map((v) => {
        const sel = v.ship.id === selected
        return (
          <li key={v.ship.id}>
            <button
              className={`ship-row${sel ? ' selected' : ''}`}
              aria-current={sel || undefined}
              onClick={() => {
                selectShip(v.ship.id, true)
                onPick?.(v.ship.id)
              }}
            >
              <span className={`ship-glyph risk-${v.risk}`} aria-hidden>
                <Rocket size={14} />
              </span>
              <span className="ship-main">
                <span className="ship-id mono">{v.ship.id}</span>
                <span className="ship-sub">
                  {NODE_BY_ID[v.ship.originId]?.id ?? v.ship.originId} → {NODE_BY_ID[v.ship.destinationId]?.id ?? v.ship.destinationId} ·{' '}
                  {v.status === 'docked' ? t('mstatus.docked') : v.status === 'scheduled' ? `${t('mstatus.scheduled')} · ${t('common.in', { t: dur(v.departure - now) })}` : `${t('ship.eta')} ${t('common.in', { t: dur(v.remainingMs) })}`}
                </span>
                <Meter value={v.ship.fuel} level={fuelLevel(v.ship.fuel)} label={`${t('ship.fuel')} ${num(v.ship.fuel)}%`} />
              </span>
              <RiskBadge level={v.risk} compact />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
