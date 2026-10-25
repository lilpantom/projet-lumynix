import { CheckCircle2, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { usePrefs } from '../../context/PreferencesContext'
import type { TranslationKey } from '../../i18n'
import { DEFAULT_WEIGHTS, routeCandidates, type RouteCandidate, type RouteWeights } from '../../sim/routing'
import { useSim } from '../../store/simStore'
import { useUi } from '../../store/uiStore'
import { candidateLabel } from '../common/eventText'
import { ConfirmDialog, RiskBadge } from '../common/ui'

const FACTORS: (keyof RouteWeights)[] = ['time', 'fuel', 'risk', 'relay', 'docking']

function sepLevel(c: RouteCandidate, threshold: number) {
  if (c.minSepKm === null) return 'ok' as const
  return c.minSepKm < threshold * 0.35 ? ('crit' as const) : c.minSepKm < threshold ? ('warn' as const) : ('ok' as const)
}

export function RouteComparison({ shipId, conflictId, onApplied }: { shipId: string; conflictId?: string; onApplied?: (c: RouteCandidate) => void }) {
  const { t, num, dt } = usePrefs()
  const sim = useSim((s) => s.sim)
  const applyRoute = useSim((s) => s.applyRoute)
  const toast = useUi((s) => s.toast)
  const [weights, setWeights] = useState<RouteWeights>(DEFAULT_WEIGHTS)
  const [showWeights, setShowWeights] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const cands = useMemo(() => routeCandidates(sim, shipId, weights), [sim, shipId, weights])
  const ship = sim.ships.find((s) => s.id === shipId)

  if (!ship || cands.length === 0) return <p className="empty">{t('route.unavailable')}</p>

  const [current, ...alts] = cands
  const best = alts.find((c) => c.feasible)
  const proposed = alts.find((c) => c.id === picked) ?? best
  const visible = showAll ? alts : alts.slice(0, 5)
  const thr = sim.settings.thresholdKm

  const reasons = (c: RouteCandidate) => {
    const out: string[] = []
    if ((c.minSepKm ?? Infinity) > (current.minSepKm ?? Infinity)) out.push(t('route.reason.risk', { from: num(current.minSepKm ?? 0), to: num(c.minSepKm ?? 0) }))
    out.push(t('route.reason.fuel', { n: num(c.fuelCost, 2), left: num(c.fuelAfter, 1) }))
    out.push(t('route.reason.time', { n: `${c.delayH >= 0 ? '+' : ''}${num(c.delayH, 1)}` }))
    out.push(t('route.reason.relay', { n: num(c.relayCoverage * 100) }))
    out.push(t('route.reason.docking', { n: num(c.dockingLoad * 100) }))
    return out
  }

  const avoided = (c: RouteCandidate) => {
    const out: string[] = []
    if (current.conflictWith && !c.conflictWith) out.push(t('route.conflictWith', { ship: current.conflictWith }))
    if (c.relayCoverage > current.relayCoverage + 0.05) out.push(t('reason.comm_degraded'))
    if (current.dockingLoad > 1 && c.dockingLoad <= 1) out.push(t('route.docking'))
    return out
  }

  return (
    <div className="routes" id="routes">
      <div className="routes-head">
        <p className="muted small">{t('route.priorityNote', { priority: t(`priority.${ship.priority}`) })}</p>
        <button className="btn sm" onClick={() => setShowWeights((s) => !s)} aria-expanded={showWeights}>
          <SlidersHorizontal size={14} aria-hidden /> {t('route.weights')}
        </button>
      </div>
      {showWeights && (
        <div className="weights">
          <p className="hint">{t('route.weightsHelp')}</p>
          {FACTORS.map((f) => (
            <label key={f} className="weight">
              <span>{t(`route.f.${f}` as TranslationKey)}</span>
              <input type="range" min={0} max={3} step={0.5} value={weights[f]} onChange={(e) => setWeights((w) => ({ ...w, [f]: Number(e.target.value) }))} />
              <output className="mono">{num(weights[f], 1)}</output>
            </label>
          ))}
          <button className="link-btn" onClick={() => setWeights(DEFAULT_WEIGHTS)}>
            {t('common.reset')}
          </button>
        </div>
      )}

      <div className="table-wrap">
        <table className="table route-table">
          <thead>
            <tr>
              <th scope="col">{t('route.title')}</th>
              <th scope="col">{t('route.delay')}</th>
              <th scope="col">{t('route.fuelImpact')}</th>
              <th scope="col">{t('route.minSep')}</th>
              <th scope="col" className="hide-mobile">{t('route.coverage')}</th>
              <th scope="col" className="hide-mobile">{t('route.docking')}</th>
              <th scope="col">{t('route.score')}</th>
            </tr>
          </thead>
          <tbody>
            {[current, ...visible].map((c) => {
              const isPicked = c.id === proposed?.id
              return (
                <tr key={c.id} className={`${c.id === 'current' ? 'current' : ''}${isPicked ? ' picked' : ''}`} onClick={() => c.id !== 'current' && setPicked(c.id)}>
                  <th scope="row">
                    {c.id === 'current' ? (
                      <span>{t('route.kind.current')}</span>
                    ) : (
                      <label className="radio">
                        <input type="radio" name={`route-${shipId}`} checked={isPicked} onChange={() => setPicked(c.id)} />
                        <span>{candidateLabel(c, t)}</span>
                      </label>
                    )}
                    <span className="row-badges">
                      {c.id === best?.id && <span className="badge risk-ok">{t('route.best')}</span>}
                      {!c.feasible && <span className="badge risk-crit">{t('route.infeasible')}</span>}
                      {c.conflictWith ? <span className="badge risk-warn">{t('route.conflictWith', { ship: c.conflictWith })}</span> : null}
                    </span>
                  </th>
                  <td className="mono">{c.id === 'current' ? '—' : `${c.delayH >= 0 ? '+' : ''}${num(c.delayH, 1)} h`}</td>
                  <td className="mono">{c.id === 'current' ? '—' : `−${num(c.fuelCost, 2)}%`}</td>
                  <td>
                    <RiskBadge level={sepLevel(c, thr)} label={c.minSepKm === null ? '—' : t('common.km', { n: num(c.minSepKm) })} />
                  </td>
                  <td className="mono hide-mobile">{num(c.relayCoverage * 100)}%</td>
                  <td className="mono hide-mobile">{num(c.dockingLoad * 100)}%</td>
                  <td className="mono">{num(c.score, 2)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {alts.length > 5 && (
        <button className="link-btn" onClick={() => setShowAll((s) => !s)}>
          {showAll ? t('route.showFewer') : t('route.showAll', { n: alts.length })}
        </button>
      )}

      {proposed && (
        <div className="compare">
          <div className="compare-col">
            <h4>{t('route.original')}</h4>
            <p>{t('route.arrival')}: {dt(current.arrival)}</p>
            <p>
              {t('route.minSep')}: <RiskBadge level={sepLevel(current, thr)} label={current.minSepKm === null ? '—' : t('common.km', { n: num(current.minSepKm) })} />
            </p>
            <p>{t('ship.fuel')}: {num(current.fuelAfter, 1)}%</p>
          </div>
          <div className="compare-col proposed">
            <h4>
              {t('route.proposed')}: {candidateLabel(proposed, t)}
            </h4>
            <p>{t('route.arrival')}: {dt(proposed.arrival)}</p>
            <p>
              {t('route.minSep')}: <RiskBadge level={sepLevel(proposed, thr)} label={proposed.minSepKm === null ? '—' : t('common.km', { n: num(proposed.minSepKm) })} />
            </p>
            <p>{t('ship.fuel')}: {num(proposed.fuelAfter, 1)}%</p>
            {avoided(proposed).length > 0 && (
              <>
                <h5>{t('route.risksAvoided')}</h5>
                <ul className="checks">
                  {avoided(proposed).map((a) => (
                    <li key={a}>
                      <CheckCircle2 size={14} aria-hidden /> {a}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <h5>{t('route.reasons')}</h5>
            <ul className="bullets">
              {reasons(proposed).map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <button className="btn primary" disabled={!proposed.feasible} onClick={() => setConfirm(true)}>
              {t('common.apply')}
            </button>
          </div>
        </div>
      )}
      {confirm && proposed && (
        <ConfirmDialog
          text={t('route.applyConfirm', { option: candidateLabel(proposed, t), ship: shipId })}
          onClose={() => setConfirm(false)}
          onConfirm={() => {
            applyRoute(shipId, proposed, conflictId)
            toast(t('route.applied', { ship: shipId }), 'ok')
            setPicked(null)
            onApplied?.(proposed)
          }}
        />
      )}
    </div>
  )
}
