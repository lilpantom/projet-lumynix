import { Bell } from 'lucide-react'
import { DAY_MS } from '../../data/bodies'
import type { CrewMember } from '../../data/crew'
import { usePrefs } from '../../context/PreferencesContext'
import { formatDate } from '../../utils/format'
import { BarsChart, TrendChart } from '../charts/Charts'
import { Field, RiskBadge } from '../common/ui'

export function checkInStatus(m: CrewMember, now: number): 'ok' | 'due' | 'overdue' {
  if (m.nextCheckIn < now) return 'overdue'
  if (m.nextCheckIn - now < 2 * DAY_MS) return 'due'
  return 'ok'
}
const statusLevel = { ok: 'ok', due: 'warn', overdue: 'warn' } as const

/** Synthetic trends for one fictional crew member. Neutral presentation: no labels, scores or diagnoses. */
export function CrewWellbeingPanel({ member, now }: { member: CrewMember; now: number }) {
  const { t, dt, locale, dur } = usePrefs()
  const status = checkInStatus(member, now)
  const day = (i: number, n: number) => formatDate(now - (n - 1 - i) * DAY_MS, locale)
  return (
    <div className="crew-panel">
      <dl className="fields two">
        <Field label={t('crew.member')} value={member.id} mono />
        <Field label={t('crew.role')} value={t(`role.${member.role}`)} />
        <Field label={t('crew.lastCheckIn')} value={dt(member.checkIns[member.checkIns.length - 1])} />
        <Field label={t('crew.status')} value={<RiskBadge level={statusLevel[status]} label={t(`crew.status.${status}`)} />} />
      </dl>
      <p className="muted small">{t('crew.notDiagnostic')}</p>
      <div className="charts-3">
        <BarsChart data={member.sleep.map((v, i) => ({ x: day(i, member.sleep.length), v }))} dataKey="v" label={t('crew.sleep')} />
        <TrendChart data={member.checkIns.map((at, i) => ({ t: at, v: member.stress[i] }))} dataKey="v" label={t('crew.stress')} domain={[1, 5]} color="var(--series-3)" />
        <TrendChart data={member.heartRate.map((v, i) => ({ t: now - (member.heartRate.length - 1 - i) * DAY_MS, v }))} dataKey="v" label={t('crew.heartRate')} unit="bpm" color="var(--series-4)" />
      </div>
      <div className="grid-2">
        <section>
          <h3>{t('crew.checkIns')}</h3>
          <ul className="event-list">
            {[...member.checkIns].reverse().map((at) => (
              <li key={at}>
                <time className="mono small">{dt(at)}</time>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3>{t('crew.followUp')}</h3>
          <ul className="event-list">
            <li>
              <Bell size={14} aria-hidden />{' '}
              {t('crew.followUpDue', { when: member.nextCheckIn < now ? t('common.ago', { t: dur(now - member.nextCheckIn) }) : t('common.in', { t: dur(member.nextCheckIn - now) }) })}
            </li>
          </ul>
        </section>
      </div>
    </div>
  )
}
