import { HeartHandshake, Lock, MessageCircleHeart, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { checkInStatus, CrewWellbeingPanel } from '../components/crew/CrewWellbeingPanel'
import { RelaxationMode } from '../components/crew/RelaxationMode'
import { WellbeingChatbot } from '../components/crew/WellbeingChatbot'
import { Panel, RiskBadge } from '../components/common/ui'
import { crewForShip } from '../data/crew'
import { usePrefs } from '../context/PreferencesContext'
import { useCrew } from '../store/crewStore'
import { useSim } from '../store/simStore'

export default function CrewPage() {
  const { t } = usePrefs()
  const ships = useSim((s) => s.sim.ships)
  const now = useSim((s) => s.sim.time)
  const startTime = useSim((s) => s.sim.startTime)
  const { gateAcknowledged, acknowledgeGate, relaxOpen, setRelax } = useCrew()
  const [shipId, setShipId] = useState(ships[0]?.id ?? '')
  const [memberId, setMemberId] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const ship = ships.find((s) => s.id === shipId)
  // Crew trends are anchored to the scenario start so they stay stable while the clock runs.
  const crew = useMemo(() => (ship ? crewForShip(ship.id, ship.crewCount, startTime) : []), [ship, startTime])
  const member = crew.find((m) => m.id === memberId) ?? crew[0]

  const tools = (
    <div className="crew-tools">
      <button className="btn primary" onClick={() => setChatOpen((o) => !o)} aria-expanded={chatOpen}>
        <MessageCircleHeart size={16} aria-hidden /> {t('crew.startCheckIn')}
      </button>
      <button className="btn" onClick={() => setRelax(true)}>
        <HeartHandshake size={16} aria-hidden /> {t('crew.relax')}
      </button>
    </div>
  )

  return (
    <div className="page">
      <header className="page-head">
        <h1>{t('crew.title')}</h1>
        <span className="badge sim-badge">{t('app.simulated')}</span>
      </header>
      <p className="notice" role="note">
        <ShieldCheck size={16} aria-hidden /> {t('crew.fictional')}
      </p>

      {!gateAcknowledged ? (
        <Panel title={<><Lock size={16} aria-hidden /> {t('crew.gateTitle')}</>} id="gate">
          <p>{t('crew.gateText')}</p>
          <p className="muted small">{t('crew.privacy')}</p>
          <div className="row-gap">
            <button className="btn primary" onClick={acknowledgeGate}>
              {t('crew.gateConfirm')}
            </button>
          </div>
          <hr />
          {tools}
        </Panel>
      ) : (
        <>
          <Panel title={t('crew.privacyTitle')} id="privacy">
            <p className="small">{t('crew.privacy')}</p>
            {tools}
          </Panel>
          <div className="crew-layout">
            <Panel title={t('crew.selectShip')} id="crew-list">
              <label className="sr-only" htmlFor="crew-ship">{t('crew.selectShip')}</label>
              <select id="crew-ship" value={shipId} onChange={(e) => (setShipId(e.target.value), setMemberId(null))}>
                {ships.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id} · {s.name}
                  </option>
                ))}
              </select>
              {crew.length === 0 ? (
                <p className="empty">{t('crew.noData')}</p>
              ) : (
                <ul className="crew-list">
                  {crew.map((m) => {
                    const st = checkInStatus(m, now)
                    return (
                      <li key={m.id}>
                        <button className={`ship-row${member?.id === m.id ? ' selected' : ''}`} aria-current={member?.id === m.id || undefined} onClick={() => setMemberId(m.id)}>
                          <span className="ship-main">
                            <span className="mono">{m.id}</span>
                            <span className="ship-sub">{t(`role.${m.role}`)}</span>
                          </span>
                          <RiskBadge level={st === 'ok' ? 'ok' : 'warn'} label={t(`crew.status.${st}`)} />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Panel>
            <Panel title={member ? `${member.id} · ${t(`role.${member.role}`)}` : t('crew.member')} id="crew-detail">
              {member ? <CrewWellbeingPanel member={member} now={now} /> : <p className="empty">{t('crew.noData')}</p>}
            </Panel>
          </div>
        </>
      )}
      {chatOpen && (
        <Panel title={t('chat.title')} id="chat" actions={<button className="btn sm" onClick={() => setChatOpen(false)}>{t('common.close')}</button>}>
          <WellbeingChatbot />
        </Panel>
      )}
      {relaxOpen && <RelaxationMode />}
    </div>
  )
}
