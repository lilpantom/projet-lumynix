import { Pause, Play, Wifi, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { usePrefs } from '../../context/PreferencesContext'
import { SPEEDS, useSim, type Speed } from '../../store/simStore'
import { SimBadge } from '../common/ui'

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(navigator.onLine)
    window.addEventListener('online', on)
    window.addEventListener('offline', on)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', on)
    }
  }, [])
  return online
}

export function SimControls() {
  const { t } = usePrefs()
  const running = useSim((s) => s.running)
  const setRunning = useSim((s) => s.setRunning)
  const speed = useSim((s) => s.speed)
  const setSpeed = useSim((s) => s.setSpeed)
  return (
    <div className="sim-controls">
      <button className="icon-btn sm" onClick={() => setRunning(!running)} aria-label={running ? t('sim.pause') : t('sim.start')} title={running ? t('sim.pause') : t('sim.start')}>
        {running ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <label>
        <span className="sr-only">{t('status.speed')}</span>
        <select value={speed} onChange={(e) => setSpeed(Number(e.target.value) as Speed)} aria-label={t('status.speed')}>
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {t(`sim.speed.${s}`)}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

export function StatusBar() {
  const { t, dt } = usePrefs()
  const time = useSim((s) => s.sim.time)
  const seed = useSim((s) => s.sim.seed)
  const running = useSim((s) => s.running)
  const online = useOnline()
  return (
    <footer className="statusbar">
      <SimBadge />
      <span className="status-item">
        <span className="muted hide-mobile">{t('status.simTime')}</span> <time className="mono">{dt(time, true)}</time>
      </span>
      <span className={`status-item ${running ? 'ok' : 'muted'}`}>{running ? t('status.running') : t('status.paused')}</span>
      <SimControls />
      <span className="status-item hide-mobile muted">{t('status.source', { seed })}</span>
      <span className="status-item push">
        {online ? <Wifi size={14} aria-hidden /> : <WifiOff size={14} aria-hidden />}
        <span className="hide-mobile">{online ? t('status.online') : t('status.offline')}</span>
      </span>
    </footer>
  )
}
