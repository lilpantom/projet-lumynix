import { Bell } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { usePrefs } from '../../context/PreferencesContext'
import { useSim } from '../../store/simStore'
import { useUi } from '../../store/uiStore'
import { eventText } from '../common/eventText'

const sevLevel = { info: 'ok', warn: 'warn', crit: 'crit' } as const

export function NotificationCenter() {
  const prefs = usePrefs()
  const { t, dt } = prefs
  const events = useSim((s) => s.sim.events)
  const markRead = useSim((s) => s.markRead)
  const selectShip = useUi((s) => s.selectShip)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const unread = events.filter((e) => !e.read).length

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="popover-wrap" ref={ref}>
      <button className="icon-btn" aria-label={`${t('top.notifications')}${unread ? ` (${t('top.unread', { n: unread })})` : ''}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Bell size={18} />
        {unread > 0 && <span className="dot-count">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="popover notif" role="dialog" aria-label={t('top.notifications')}>
          <div className="popover-head">
            <strong>{t('top.notifications')}</strong>
            <button className="link-btn" onClick={() => markRead()} disabled={!unread}>
              {t('top.markAllRead')}
            </button>
          </div>
          {events.length === 0 ? (
            <p className="empty">{t('top.noNotifications')}</p>
          ) : (
            <ul className="notif-list">
              {events.slice(0, 40).map((e) => (
                <li key={e.id} className={e.read ? '' : 'unread'}>
                  <button
                    onClick={() => {
                      markRead([e.id])
                      if (e.shipId) {
                        selectShip(e.shipId, true)
                        navigate('/dashboard')
                      }
                      setOpen(false)
                    }}
                  >
                    <span className={`sev-dot risk-${sevLevel[e.severity]}`} aria-hidden />
                    <span className="notif-text">
                      {eventText(e.key, e.params, prefs)}
                      <small>{dt(e.at)}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
