import { CheckCircle2, Circle, Info, Siren } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { Panel, RiskBadge, SimBadge } from '../components/common/ui'
import { RouteComparison } from '../components/traffic/RouteComparison'
import { AU_KM } from '../data/bodies'
import { NODES } from '../data/nodes'
import { usePrefs } from '../context/PreferencesContext'
import { hasKey, type TranslationKey } from '../i18n'
import { commStatus } from '../sim/comms'
import { nodePosition } from '../sim/orbits'
import { missionStatus, shipPosition } from '../sim/trajectory'
import { dist } from '../sim/vec'
import { useSim } from '../store/simStore'
import { useUi } from '../store/uiStore'
import type { Conflict, SimState } from '../types'

function nearestNode(sim: SimState, c: Conflict) {
  const a = sim.ships.find((s) => s.id === c.a)
  if (!a) return null
  const p = shipPosition(a, c.tca)
  let best = { id: '', d: Infinity }
  for (const n of NODES) {
    const d = dist(p, nodePosition(n.id, c.tca))
    if (d < best.d) best = { id: n.id, d }
  }
  return { node: NODES.find((n) => n.id === best.id)!, km: best.d * AU_KM }
}

function Step({ n, done, active, children }: { n: number; done: boolean; active: boolean; children: ReactNode }) {
  const { t } = usePrefs()
  return (
    <li className={`step${done ? ' done' : ''}${active ? ' active' : ''}`} aria-current={active ? 'step' : undefined}>
      <span className="step-icon" aria-hidden>
        {done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
      </span>
      <div>
        <p className="step-title">
          {n}. {t(`traffic.step${n}` as TranslationKey)}
        </p>
        {children}
      </div>
    </li>
  )
}

function ResponseProtocol({ conflict, onClose }: { conflict: Conflict; onClose: () => void }) {
  const { t, num, dt, dur } = usePrefs()
  const sim = useSim((s) => s.sim)
  const acknowledge = useSim((s) => s.acknowledge)
  const [mover, setMover] = useState(() => {
    // Prefer the lower-priority / not-yet-departed ship as the default maneuvering ship.
    const a = sim.ships.find((s) => s.id === conflict.b)
    return a && missionStatus(a, sim.time) !== 'docked' ? conflict.b : conflict.a
  })
  const [acked, setAcked] = useState(() => sim.audit.some((x) => x.conflictId === conflict.id && x.action === 'audit.acknowledged'))
  const [result, setResult] = useState<null | { cleared: boolean; sep?: number }>(null)
  const live = sim.conflicts.find((c) => c.id === conflict.id)
  const near = nearestNode(sim, conflict)
  const comms = [conflict.a, conflict.b].map((id) => {
    const s = sim.ships.find((x) => x.id === id)
    return { id, status: s ? commStatus(sim, s, sim.time) : 'lost' }
  })
  const audit = sim.audit.filter((a) => a.conflictId === conflict.id)
  const shipsMovable = [conflict.a, conflict.b].filter((id) => {
    const s = sim.ships.find((x) => x.id === id)
    return s && missionStatus(s, sim.time) !== 'docked'
  })

  return (
    <Panel
      title={
        <>
          <Siren size={16} aria-hidden /> {t('traffic.protocol')}: <span className="mono">{conflict.a} / {conflict.b}</span>
        </>
      }
      actions={
        <button className="btn sm" onClick={onClose}>
          {t('common.close')}
        </button>
      }
      id="protocol"
    >
      <p className="disclaimer">{t('hud.decisionSupport')}</p>
      <ol className="steps">
        <Step n={1} done={acked} active={!acked}>
          <ul className="mini-list">
            {comms.map((c) => (
              <li key={c.id}>
                <span className="mono">{c.id}</span>
                <RiskBadge level={c.status === 'nominal' ? 'ok' : c.status === 'degraded' ? 'warn' : 'unknown'} label={t(`comm.${c.status}`)} />
              </li>
            ))}
          </ul>
          <p className="small">{comms.every((c) => c.status === 'nominal') ? t('traffic.telemetryOk') : comms.filter((c) => c.status !== 'nominal').map((c) => t('traffic.telemetryBad', { ship: c.id, status: t(`comm.${c.status}`) })).join(' ')}</p>
          {!acked && (
            <button
              className="btn sm primary"
              onClick={() => {
                acknowledge(conflict)
                setAcked(true)
              }}
            >
              {t('traffic.acknowledge')}
            </button>
          )}
        </Step>
        <Step n={2} done={acked} active={false}>
          <p className="small">
            <span className="mono">{conflict.a}</span>, <span className="mono">{conflict.b}</span> · {t('traffic.minSep')} {t('common.km', { n: num(live?.minSepKm ?? conflict.minSepKm) })} · {dt(conflict.tca)} ({t('common.in', { t: dur(conflict.tca - sim.time) })})
          </p>
          {near && <p className="small">{t('traffic.nearby', { node: near.node.name, km: num(near.km) })}</p>}
        </Step>
        <Step n={3} done={!!result} active={acked && !result}>
          {acked && !result && (
            <>
              <label className="inline-field">
                <span>{t('traffic.chooseShip')}</span>
                <select value={mover} onChange={(e) => setMover(e.target.value)}>
                  {shipsMovable.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </label>
              <RouteComparison
                key={mover}
                shipId={mover}
                conflictId={conflict.id}
                onApplied={() => {
                  const after = useSim.getState().sim.conflicts.find((c) => c.id === conflict.id)
                  setResult({ cleared: !after, sep: after?.minSepKm })
                }}
              />
            </>
          )}
        </Step>
        <Step n={4} done={!!result} active={false}>
          {null}
        </Step>
        <Step n={5} done={!!result} active={false}>
          {null}
        </Step>
        <Step n={6} done={!!result} active={false}>
          {result && (
            <p className={`small ${result.cleared ? 'ok-text' : 'warn-text'}`} role="status">
              {t('traffic.recalc', { result: result.cleared ? t('traffic.resolvedAll') : t('traffic.stillConflict', { km: num(result.sep ?? 0) }) })}
            </p>
          )}
        </Step>
        <Step n={7} done={audit.some((a) => a.action !== 'audit.acknowledged')} active={false}>
          {audit.length > 0 && <AuditTable entries={audit} />}
        </Step>
      </ol>
    </Panel>
  )
}

function AuditTable({ entries }: { entries: SimState['audit'] }) {
  const { t, dt } = usePrefs()
  if (!entries.length) return <p className="empty">{t('traffic.auditEmpty')}</p>
  return (
    <div className="table-wrap">
      <table className="table compact">
        <thead>
          <tr>
            <th scope="col">{t('status.simTime')}</th>
            <th scope="col">{t('ship.id')}</th>
            <th scope="col">{t('hud.recommendations')}</th>
            <th scope="col" className="hide-mobile">{t('common.details')}</th>
            <th scope="col">{t('ship.status')}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((a) => (
            <tr key={a.id}>
              <td className="small">{dt(a.at)}</td>
              <td className="mono">{a.shipId}</td>
              <td>{hasKey(a.action) ? t(a.action, { h: a.actionParams?.h ?? '', node: a.actionParams?.node ?? '' }) : a.action}</td>
              <td className="mono small hide-mobile">{a.detail}</td>
              <td>
                <RiskBadge level={a.outcome === 'resolved' || a.outcome === 'applied' ? 'ok' : a.outcome === 'reduced' ? 'warn' : 'crit'} label={t(`outcome.${a.outcome}`)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function TrafficPage() {
  const { t, num, dt, dur } = usePrefs()
  const sim = useSim((s) => s.sim)
  const setSettings = useSim((s) => s.setSettings)
  const drill = useSim((s) => s.drill)
  const toast = useUi((s) => s.toast)
  const selectShip = useUi((s) => s.selectShip)
  const [params, setParams] = useSearchParams()
  const openId = params.get('c')
  const [threshold, setThreshold] = useState(String(sim.settings.thresholdKm))
  const [horizon, setHorizon] = useState(String(sim.settings.horizonH))
  const transit = useMemo(() => sim.ships.filter((s) => missionStatus(s, sim.time) === 'in_transit').map((s) => s.id), [sim])
  const [target, setTarget] = useState('')
  // Keep the snapshot of the conflict being handled even after it is resolved.
  const [handled, setHandled] = useState<Conflict | null>(null)

  useEffect(() => {
    if (!openId) return
    const c = sim.conflicts.find((x) => x.id === openId)
    if (c && handled?.id !== c.id) setHandled(c)
  }, [openId, sim.conflicts, handled])

  const applySettings = () => {
    const th = Math.round(Number(threshold))
    const h = Math.round(Number(horizon))
    if (!(th >= 10_000 && th <= 5_000_000 && h >= 6 && h <= 240)) return
    setSettings({ thresholdKm: th, horizonH: h })
  }
  const settingsValid = Number(threshold) >= 10_000 && Number(threshold) <= 5_000_000 && Number(horizon) >= 6 && Number(horizon) <= 240
  const targetId = target || transit[0] || ''

  return (
    <div className="page">
      <header className="page-head">
        <h1>{t('traffic.title')}</h1>
        <SimBadge />
      </header>
      <p className="notice" role="note">
        <Info size={16} aria-hidden /> {t('traffic.model')}
      </p>
      <div className="grid-2">
        <Panel title={t('traffic.settings')} id="tsettings">
          <form
            className="form inline-form"
            onSubmit={(e) => {
              e.preventDefault()
              applySettings()
            }}
          >
            <div className="form-row">
              <label htmlFor="thr">{t('traffic.threshold')}</label>
              <input id="thr" type="number" min={10000} max={5000000} step={10000} value={threshold} onChange={(e) => setThreshold(e.target.value)} aria-invalid={!settingsValid || undefined} />
            </div>
            <div className="form-row">
              <label htmlFor="hor">{t('traffic.horizon')}</label>
              <input id="hor" type="number" min={6} max={240} value={horizon} onChange={(e) => setHorizon(e.target.value)} aria-invalid={!settingsValid || undefined} />
            </div>
            {!settingsValid && <p className="field-error">{t('ships.err.range', { min: '10 000 km / 6 h', max: '5 000 000 km / 240 h' })}</p>}
            <button className="btn" disabled={!settingsValid}>
              {t('common.apply')}
            </button>
          </form>
        </Panel>
        <Panel title={t('traffic.drill')} id="drill">
          <p className="muted small">{t('traffic.drillHelp')}</p>
          <div className="form inline-form">
            <div className="form-row">
              <label htmlFor="drill-target">{t('traffic.drillTarget')}</label>
              <select id="drill-target" value={targetId} onChange={(e) => setTarget(e.target.value)}>
                {transit.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="btn warn"
              disabled={!targetId}
              onClick={() => {
                const id = drill(targetId)
                if (!id) return toast(t('traffic.drillFail'), 'warn')
                toast(t('traffic.drillDone', { id, target: targetId }), 'warn')
                const c = useSim.getState().sim.conflicts.find((x) => x.a === id || x.b === id)
                if (c) {
                  setHandled(c)
                  setParams({ c: c.id })
                }
              }}
            >
              <Siren size={15} aria-hidden /> {t('traffic.drill')}
            </button>
          </div>
        </Panel>
      </div>

      <Panel title={`${t('dash.conflicts')} (${num(sim.conflicts.length)})`} id="conflicts">
        {sim.conflicts.length === 0 ? (
          <p className="empty">{t('traffic.none')}</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{t('ship.risk')}</th>
                  <th scope="col">{t('traffic.pair')}</th>
                  <th scope="col">{t('traffic.tca')}</th>
                  <th scope="col">{t('traffic.minSep')}</th>
                  <th scope="col" className="hide-mobile">{t('traffic.relSpeed')}</th>
                  <th scope="col"><span className="sr-only">{t('common.open')}</span></th>
                </tr>
              </thead>
              <tbody>
                {sim.conflicts.map((c) => (
                  <tr key={c.id} className={handled?.id === c.id ? 'picked' : ''}>
                    <td><RiskBadge level={c.severity} /></td>
                    <th scope="row">
                      <button className="link-btn mono" onClick={() => selectShip(c.a)}>{c.a}</button> / <button className="link-btn mono" onClick={() => selectShip(c.b)}>{c.b}</button>
                    </th>
                    <td>
                      {dt(c.tca)} <span className="muted small">({t('common.in', { t: dur(c.tca - sim.time) })})</span>
                    </td>
                    <td className="mono">{t('common.km', { n: num(c.minSepKm) })}</td>
                    <td className="mono hide-mobile">{t('common.kms', { n: num(c.relSpeedKms, 1) })}</td>
                    <td>
                      <button
                        className="btn sm"
                        onClick={() => {
                          setHandled(c)
                          setParams({ c: c.id })
                        }}
                      >
                        {t('traffic.respond')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {handled && (
        <ResponseProtocol
          key={handled.id}
          conflict={handled}
          onClose={() => {
            setHandled(null)
            setParams({})
          }}
        />
      )}

      <Panel title={t('traffic.audit')} id="audit">
        <AuditTable entries={sim.audit} />
      </Panel>
    </div>
  )
}
