import { ArrowDownWideNarrow, ArrowUpNarrowWide, FilterX } from 'lucide-react'
import { PORTS } from '../../data/nodes'
import { usePrefs } from '../../context/PreferencesContext'
import { EMPTY_FILTERS, useUi, type Filters, type SortKey } from '../../store/uiStore'
import type { MissionStatus, MissionType, RiskLevel } from '../../types'

const MISSIONS: MissionType[] = ['cargo', 'passenger', 'science', 'mining', 'medical']
const STATUSES: MissionStatus[] = ['in_transit', 'scheduled', 'docked']
const RISKS: RiskLevel[] = ['crit', 'warn', 'unknown', 'ok']
const SORTS: SortKey[] = ['risk', 'eta', 'fuel', 'id']

export function ShipFilters({ compact = false }: { compact?: boolean }) {
  const { t } = usePrefs()
  const f = useUi((s) => s.filters)
  const set = useUi((s) => s.setFilters)
  const active = f.destination || f.mission || f.status || f.risk || f.query
  return (
    <div className={`filters${compact ? ' compact' : ''}`}>
      <input type="search" value={f.query} onChange={(e) => set({ query: e.target.value })} placeholder={t('top.search')} aria-label={t('top.searchLabel')} className="filter-q" />
      <label>
        <span>{t('filter.destination')}</span>
        <select value={f.destination} onChange={(e) => set({ destination: e.target.value })}>
          <option value="">{t('common.all')}</option>
          {PORTS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{t('filter.mission')}</span>
        <select value={f.mission} onChange={(e) => set({ mission: e.target.value as Filters['mission'] })}>
          <option value="">{t('common.all')}</option>
          {MISSIONS.map((m) => (
            <option key={m} value={m}>
              {t(`mission.${m}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{t('filter.status')}</span>
        <select value={f.status} onChange={(e) => set({ status: e.target.value as Filters['status'] })}>
          <option value="">{t('common.all')}</option>
          {STATUSES.map((m) => (
            <option key={m} value={m}>
              {t(`mstatus.${m}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{t('filter.risk')}</span>
        <select value={f.risk} onChange={(e) => set({ risk: e.target.value as Filters['risk'] })}>
          <option value="">{t('common.all')}</option>
          {RISKS.map((m) => (
            <option key={m} value={m}>
              {t(`risk.${m}`)}
            </option>
          ))}
        </select>
      </label>
      <div className="sort-row">
        <label>
          <span>{t('filter.sort')}</span>
          <select value={f.sort} onChange={(e) => set({ sort: e.target.value as SortKey })}>
            {SORTS.map((m) => (
              <option key={m} value={m}>
                {t(`sort.${m}`)}
              </option>
            ))}
          </select>
        </label>
        <button className="icon-btn sm" onClick={() => set({ desc: !f.desc })} aria-label={f.desc ? t('sort.desc') : t('sort.asc')} title={f.desc ? t('sort.desc') : t('sort.asc')}>
          {f.desc ? <ArrowDownWideNarrow size={16} /> : <ArrowUpNarrowWide size={16} />}
        </button>
        {active && (
          <button className="icon-btn sm" onClick={() => set({ ...EMPTY_FILTERS, sort: f.sort, desc: f.desc })} aria-label={t('filter.clear')} title={t('filter.clear')}>
            <FilterX size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
