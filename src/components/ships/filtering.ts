import { RISK_ORDER } from '../../sim/engine'
import type { ShipView } from '../../sim/selectors'
import type { Filters } from '../../store/uiStore'

export function applyFilters(views: ShipView[], f: Filters): ShipView[] {
  const q = f.query.trim().toLowerCase()
  const out = views.filter(
    (v) =>
      (!q || v.ship.id.toLowerCase().includes(q) || v.ship.name.toLowerCase().includes(q)) &&
      (!f.destination || v.ship.destinationId === f.destination) &&
      (!f.mission || v.ship.missionType === f.mission) &&
      (!f.status || v.status === f.status) &&
      (!f.risk || v.risk === f.risk),
  )
  const cmp: Record<Filters['sort'], (a: ShipView, b: ShipView) => number> = {
    id: (a, b) => a.ship.id.localeCompare(b.ship.id),
    eta: (a, b) => a.eta - b.eta,
    fuel: (a, b) => a.ship.fuel - b.ship.fuel,
    risk: (a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk] || a.ship.id.localeCompare(b.ship.id) * -1,
  }
  const sign = f.desc ? -1 : 1
  return out.sort((a, b) => sign * cmp[f.sort](a, b))
}
