import { CalendarClock, CheckCircle2, ChevronDown, Info, StickyNote } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Field, Meter, Panel, RiskBadge, SimBadge } from '../components/common/ui'
import { MaintenanceTimeline } from '../components/maintenance/MaintenanceTimeline'
import { NODE_BY_ID } from '../data/nodes'
import { usePrefs } from '../context/PreferencesContext'
import { hasKey, type TranslationKey } from '../i18n'
import { assetAvailability, componentLevel, projectedWarnTime, reasons, type Availability } from '../sim/maintenance'
import { useSim } from '../store/simStore'
import { useUi } from '../store/uiStore'
import type { Component } from '../types'

function ComponentCard({ c, open, onToggle }: { c: Component; open: boolean; onToggle: () => void }) {
  const { t, num, dt, dur } = usePrefs()
  const now = useSim((s) => s.sim.time)
  const service = useSim((s) => s.service)
  const schedule = useSim((s) => s.schedule)
  const note = useSim((s) => s.note)
  const toast = useUi((s) => s.toast)
  const [noteText, setNoteText] = useState('')
  const [inH, setInH] = useState(24)
  const level = componentLevel(c, now)
  const why = reasons(c, now)
  const projected = projectedWarnTime(c, now)
  const inService = (c.inServiceUntil ?? 0) > now
  const assetName = c.assetKind === 'node' ? NODE_BY_ID[c.assetId]?.name ?? c.assetId : c.assetId
  const steps = [`step.${c.kind}.1`, 'step.generic.1', 'step.generic.2', 'step.generic.3'].filter(hasKey) as TranslationKey[]

  return (
    <li className={`comp-card risk-border-${level}`}>
      <button className="comp-head" onClick={onToggle} aria-expanded={open}>
        <RiskBadge level={level} compact />
        <span className="comp-name">
          <strong>{t(`comp.${c.kind}`)}</strong>
          <small className="muted">{assetName}</small>
        </span>
        <span className="comp-wear">
          <Meter value={c.wear} level={level === 'ok' ? 'ok' : level} label={t('maint.condition')} />
          <span className="mono small">{num(c.wear)}%</span>
        </span>
        <span className="muted small hide-mobile">{dt(c.nextInspection)}</span>
        <ChevronDown size={16} className={`chev${open ? ' open' : ''}`} aria-hidden />
      </button>
      {open && (
        <div className="comp-body">
          <dl className="fields">
            <Field label={t('maint.lastService')} value={dt(c.lastService)} />
            <Field label={t('maint.nextInspection')} value={`${dt(c.nextInspection)} (${c.nextInspection < now ? t('common.ago', { t: dur(now - c.nextInspection) }) : t('common.in', { t: dur(c.nextInspection - now) })})`} />
            <Field label={t('maint.condition')} value={`${num(c.wear, 1)}% (+${num(c.wearPerDay, 2)}%/d)`} mono />
            <Field label={t('maint.spares')} value={num(c.spares)} mono />
            <Field label={t('maint.duration')} value={t('common.hours', { n: c.durationH })} />
            <Field label={t('ship.availability')} value={inService ? `${t('avail.in_service')} ${t('maint.until', { t: dt(c.inServiceUntil!) })}` : '—'} />
          </dl>
          <h4>{t('maint.why')}</h4>
          <ul className="bullets">
            {why.length === 0 ? <li>{t('maint.r.ok')}</li> : why.map((r) => <li key={r}>{t(`maint.r.${r}` as TranslationKey, { wear: num(c.wear) })}</li>)}
            {projected && <li className="muted">{t('maint.projected', { t: dt(projected) })}</li>}
          </ul>
          <h4>{t('maint.steps')}</h4>
          <ol className="bullets">
            {steps.map((k) => (
              <li key={k}>{t(k)}</li>
            ))}
          </ol>
          <div className="comp-actions">
            <button
              className="btn sm primary"
              disabled={inService}
              onClick={() => {
                service(c.id)
                toast(t('maint.completed', { component: t(`comp.${c.kind}`), asset: assetName }), 'ok')
              }}
            >
              <CheckCircle2 size={14} aria-hidden /> {t('maint.complete')}
            </button>
            <label className="inline-field">
              <span>{t('maint.scheduleIn')}</span>
              <select value={inH} onChange={(e) => setInH(Number(e.target.value))}>
                {[6, 24, 72, 168].map((h) => (
                  <option key={h} value={h}>
                    {dur(h * 3_600_000)}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="btn sm"
              onClick={() => {
                schedule(c.id, inH)
                toast(t('maint.scheduled'), 'ok')
              }}
            >
              <CalendarClock size={14} aria-hidden /> {t('maint.schedule')}
            </button>
          </div>
          <form
            className="note-form"
            onSubmit={(e) => {
              e.preventDefault()
              if (!noteText.trim()) return
              note(c.id, noteText.trim())
              setNoteText('')
            }}
          >
            <label className="sr-only" htmlFor={`note-${c.id}`}>{t('maint.note')}</label>
            <input id={`note-${c.id}`} value={noteText} maxLength={500} onChange={(e) => setNoteText(e.target.value)} placeholder={t('maint.notePlaceholder')} />
            <button className="btn sm" disabled={!noteText.trim()}>
              <StickyNote size={14} aria-hidden /> {t('maint.note')}
            </button>
          </form>
          <h4>{t('maint.history')}</h4>
          <ul className="event-list">
            {c.history.map((h, i) => (
              <li key={i}>
                <time className="muted mono small">{dt(h.at)}</time>
                <span>{h.kind === 'inspection_scheduled' ? t('maint.h.inspection_scheduled', { t: dt(Number(h.text)) }) : t(`maint.h.${h.kind}`, { text: h.text ?? '' })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  )
}

const AVAIL_LEVEL: Record<Availability, 'ok' | 'warn' | 'crit' | 'unknown'> = { available: 'ok', limited: 'warn', grounded: 'crit', in_service: 'unknown' }

export default function MaintenancePage() {
  const { t, num } = usePrefs()
  const sim = useSim((s) => s.sim)
  const [onlyWarn, setOnlyWarn] = useState(true)
  const [scope, setScope] = useState<'ship' | 'node'>('ship')
  const [openId, setOpenId] = useState<string | null>(null)
  const now = sim.time

  const comps = useMemo(
    () =>
      sim.components
        .filter((c) => c.assetKind === scope && (!onlyWarn || componentLevel(c, now) !== 'ok' || c.id === openId))
        .sort((a, b) => {
          const order = { crit: 0, warn: 1, unknown: 2, ok: 3 }
          return order[componentLevel(a, now)] - order[componentLevel(b, now)] || b.wear - a.wear
        }),
    [sim.components, scope, onlyWarn, now, openId],
  )

  const availability = sim.ships.map((s) => ({ id: s.id, a: assetAvailability(sim.components, s.id, now, s) }))
  const counts = availability.reduce<Record<Availability, number>>((acc, x) => ({ ...acc, [x.a]: acc[x.a] + 1 }), { available: 0, limited: 0, grounded: 0, in_service: 0 })

  return (
    <div className="page">
      <header className="page-head">
        <h1>{t('maint.title')}</h1>
        <SimBadge />
      </header>
      <p className="notice" role="note">
        <Info size={16} aria-hidden /> {t('maint.explain')}
      </p>
      <Panel title={t('maint.fleetAvailability')} id="avail">
        <div className="avail-grid">
          {(Object.keys(counts) as Availability[]).map((k) => (
            <div key={k} className={`stat risk-${AVAIL_LEVEL[k]}`}>
              <span className="stat-v">{num(counts[k])}</span>
              <span className="stat-l">{t(`avail.${k}`)}</span>
            </div>
          ))}
        </div>
        <ul className="chip-list">
          {availability
            .filter((x) => x.a === 'grounded' || x.a === 'in_service')
            .map((x) => (
              <li key={x.id}>
                <RiskBadge level={AVAIL_LEVEL[x.a]} label={`${x.id} · ${t(`avail.${x.a}`)}`} />
              </li>
            ))}
        </ul>
        <p className="muted small">{t('maint.availabilityHelp')}</p>
      </Panel>
      <Panel
        title={t('nav.maintenance')}
        id="items"
        actions={
          <div className="seg" role="group">
            <button className={scope === 'ship' ? 'on' : ''} aria-pressed={scope === 'ship'} onClick={() => setScope('ship')}>
              {t('maint.ships')}
            </button>
            <button className={scope === 'node' ? 'on' : ''} aria-pressed={scope === 'node'} onClick={() => setScope('node')}>
              {t('maint.stations')}
            </button>
          </div>
        }
      >
        <div className="seg" role="group" aria-label={t('maint.filterLevel')}>
          <button className={onlyWarn ? 'on' : ''} aria-pressed={onlyWarn} onClick={() => setOnlyWarn(true)}>
            {t('maint.onlyWarnings')}
          </button>
          <button className={!onlyWarn ? 'on' : ''} aria-pressed={!onlyWarn} onClick={() => setOnlyWarn(false)}>
            {t('maint.allItems')}
          </button>
        </div>
        <MaintenanceTimeline components={comps} now={now} picked={openId} onPick={(id) => setOpenId(id)} />
        {comps.length === 0 ? (
          <p className="empty">{t('maint.noItems')}</p>
        ) : (
          <ul className="comp-list">
            {comps.map((c) => (
              <ComponentCard key={c.id} c={c} open={openId === c.id} onToggle={() => setOpenId((o) => (o === c.id ? null : c.id))} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

