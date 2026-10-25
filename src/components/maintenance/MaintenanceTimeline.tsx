import { DAY_MS } from '../../data/bodies'
import { usePrefs } from '../../context/PreferencesContext'
import { componentLevel } from '../../sim/maintenance'
import type { Component } from '../../types'
import { formatDate } from '../../utils/format'

const SPAN_BEFORE = 3 * DAY_MS
const SPAN_AFTER = 45 * DAY_MS

/** Upcoming inspections on a time axis (overdue items pile up on the left edge). */
export function MaintenanceTimeline({ components, now, onPick, picked }: { components: Component[]; now: number; onPick: (id: string) => void; picked: string | null }) {
  const { t, dt, locale } = usePrefs()
  const formatDay = (x: number) => formatDate(x, locale)
  const from = now - SPAN_BEFORE
  const to = now + SPAN_AFTER
  const pos = (x: number) => ((Math.min(to, Math.max(from, x)) - from) / (to - from)) * 100
  const ticks = Array.from({ length: 7 }, (_, i) => from + ((to - from) * i) / 6)
  return (
    <div className="timeline" dir="ltr" aria-label={t('maint.nextInspection')}>
      <div className="tl-axis">
        <span className="tl-now" style={{ left: `${pos(now)}%` }} aria-hidden />
        {ticks.map((x) => (
          <span key={x} className="tl-tick" style={{ left: `${pos(x)}%` }}>
            {formatDay(x)}
          </span>
        ))}
      </div>
      <div className="tl-track">
        {components.map((c, i) => {
          const level = componentLevel(c, now)
          return (
            <button
              key={c.id}
              className={`tl-dot risk-${level}${picked === c.id ? ' picked' : ''}`}
              style={{ left: `${pos(c.nextInspection)}%`, top: `${(i % 4) * 22 + 4}px` }}
              onClick={() => onPick(c.id)}
              title={`${c.assetId} · ${t(`comp.${c.kind}`)} · ${dt(c.nextInspection)}`}
              aria-label={`${c.assetId} ${t(`comp.${c.kind}`)} ${t('maint.nextInspection')} ${dt(c.nextInspection)}`}
            />
          )
        })}
      </div>
    </div>
  )
}
