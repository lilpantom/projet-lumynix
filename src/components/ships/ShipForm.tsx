import { useState, type FormEvent } from 'react'
import { PORTS } from '../../data/nodes'
import { usePrefs } from '../../context/PreferencesContext'
import type { TranslationKey } from '../../i18n'
import { normalizeShipId, validateShipId } from '../../sim/shipId'
import { useSim } from '../../store/simStore'
import { useUi } from '../../store/uiStore'
import type { CargoCategory, MissionType, Priority, Ship } from '../../types'
import { Dialog } from '../common/ui'

const MISSIONS: MissionType[] = ['cargo', 'passenger', 'science', 'mining', 'medical']
const CARGO: CargoCategory[] = ['supplies', 'ore', 'water', 'passengers', 'equipment', 'medical', 'research']
const PRIORITIES: Priority[] = ['low', 'normal', 'high', 'critical']

type Errors = Partial<Record<'id' | 'name' | 'dest' | 'depart' | 'transit' | 'crew', string>>

/** Create (no `ship`) or edit a simulated spacecraft. Identifier rules are enforced on every change. */
export function ShipForm({ ship, onClose }: { ship?: Ship; onClose: () => void }) {
  const { t } = usePrefs()
  const ships = useSim((s) => s.sim.ships)
  const addShip = useSim((s) => s.addShip)
  const updateShip = useSim((s) => s.updateShip)
  const toast = useUi((s) => s.toast)
  const [id, setId] = useState(ship?.id ?? '')
  const [name, setName] = useState(ship?.name ?? '')
  const [missionType, setMission] = useState<MissionType>(ship?.missionType ?? 'cargo')
  const [cargo, setCargo] = useState<CargoCategory>(ship?.cargo ?? 'supplies')
  const [priority, setPriority] = useState<Priority>(ship?.priority ?? 'normal')
  const [originId, setOrigin] = useState('CRT')
  const [destinationId, setDest] = useState('ARS')
  const [departInH, setDepart] = useState('4')
  const [transitDays, setTransit] = useState('20')
  const [crewCount, setCrew] = useState('3')
  const [touched, setTouched] = useState(false)
  const ids = ships.map((s) => s.id)
  const normalized = normalizeShipId(id)
  const idError = validateShipId(id, ids, ship?.id)

  const range = (v: string, min: number, max: number) => {
    const n = Number(v)
    return Number.isFinite(n) && n >= min && n <= max ? null : t('ships.err.range', { min, max })
  }

  const validate = (): Errors => {
    const e: Errors = {}
    if (idError) e.id = t(`ships.err.${idError}` as TranslationKey)
    if (name.trim().length < 2 || name.trim().length > 40) e.name = t('ships.err.name')
    if (!ship) {
      if (originId === destinationId) e.dest = t('ships.err.sameNode')
      e.depart = range(departInH, 0, 240) ?? undefined
      e.transit = range(transitDays, 3, 120) ?? undefined
      e.crew = range(crewCount, 1, 12) ?? undefined
    }
    return Object.fromEntries(Object.entries(e).filter(([, v]) => v)) as Errors
  }
  const errors = touched ? validate() : {}

  const submit = (ev: FormEvent) => {
    ev.preventDefault()
    setTouched(true)
    if (Object.keys(validate()).length) return
    if (ship) {
      updateShip(ship.id, { id: normalized, name: name.trim(), missionType, cargo, priority })
      toast(t('ships.updated', { id: normalized }), 'ok')
    } else {
      addShip({ id: normalized, name: name.trim(), missionType, cargo, priority, originId, destinationId, departInH: Number(departInH), transitDays: Number(transitDays), crewCount: Math.round(Number(crewCount)) })
      toast(t('ships.created', { id: normalized }), 'ok')
    }
    onClose()
  }

  const err = (k: keyof Errors) => (errors[k] ? <p className="field-error" id={`sf-${k}-err`}>{errors[k]}</p> : null)
  const aria = (k: keyof Errors) => ({ 'aria-invalid': !!errors[k] || undefined, 'aria-describedby': errors[k] ? `sf-${k}-err` : undefined })

  return (
    <Dialog
      title={ship ? t('ships.editTitle', { id: ship.id }) : t('ships.addTitle')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="ship-form" className="btn primary">
            {t('common.save')}
          </button>
        </>
      }
    >
      <form id="ship-form" className="form grid-form" onSubmit={submit} noValidate>
        <div className="form-row span-2">
          <label htmlFor="sf-id">{t('ship.id')}</label>
          <input id="sf-id" className="mono" value={id} onChange={(e) => setId(e.target.value)} onBlur={() => setTouched(true)} autoComplete="off" spellCheck={false} {...aria('id')} aria-describedby={errors.id ? 'sf-id-err' : 'sf-id-help'} />
          <p className="hint" id="sf-id-help">
            {t('ships.idHelp')}
            {normalized && normalized !== id && !idError && <> {t('ships.idPreview', { id: normalized })}</>}
          </p>
          {err('id')}
        </div>
        <div className="form-row span-2">
          <label htmlFor="sf-name">{t('ship.name')}</label>
          <input id="sf-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} {...aria('name')} />
          {err('name')}
        </div>
        <div className="form-row">
          <label htmlFor="sf-mission">{t('ship.mission')}</label>
          <select id="sf-mission" value={missionType} onChange={(e) => setMission(e.target.value as MissionType)}>
            {MISSIONS.map((m) => (
              <option key={m} value={m}>{t(`mission.${m}`)}</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label htmlFor="sf-cargo">{t('ship.cargo')}</label>
          <select id="sf-cargo" value={cargo} onChange={(e) => setCargo(e.target.value as CargoCategory)}>
            {CARGO.map((m) => (
              <option key={m} value={m}>{t(`cargo.${m}`)}</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label htmlFor="sf-priority">{t('ship.priority')}</label>
          <select id="sf-priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {PRIORITIES.map((m) => (
              <option key={m} value={m}>{t(`priority.${m}`)}</option>
            ))}
          </select>
        </div>
        {!ship && (
          <>
            <div className="form-row">
              <label htmlFor="sf-crew">{t('ships.crewCount')}</label>
              <input id="sf-crew" type="number" inputMode="numeric" min={1} max={12} value={crewCount} onChange={(e) => setCrew(e.target.value)} {...aria('crew')} />
              {err('crew')}
            </div>
            <div className="form-row">
              <label htmlFor="sf-origin">{t('ship.origin')}</label>
              <select id="sf-origin" value={originId} onChange={(e) => setOrigin(e.target.value)}>
                {PORTS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label htmlFor="sf-dest">{t('ship.destination')}</label>
              <select id="sf-dest" value={destinationId} onChange={(e) => setDest(e.target.value)} {...aria('dest')}>
                {PORTS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {err('dest')}
            </div>
            <div className="form-row">
              <label htmlFor="sf-depart">{t('ships.departIn')}</label>
              <input id="sf-depart" type="number" inputMode="decimal" min={0} max={240} value={departInH} onChange={(e) => setDepart(e.target.value)} {...aria('depart')} />
              {err('depart')}
            </div>
            <div className="form-row">
              <label htmlFor="sf-transit">{t('ships.transitDays')}</label>
              <input id="sf-transit" type="number" inputMode="decimal" min={3} max={120} value={transitDays} onChange={(e) => setTransit(e.target.value)} {...aria('transit')} />
              {err('transit')}
            </div>
          </>
        )}
      </form>
    </Dialog>
  )
}
