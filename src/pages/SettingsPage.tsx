import { Database, LogOut, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { ConfirmDialog, Panel } from '../components/common/ui'
import { LanguageSelector } from '../components/layout/LanguageSelector'
import { SimControls } from '../components/layout/StatusBar'
import { usePrefs, type Motion, type Quality } from '../context/PreferencesContext'
import { disablePersistence, useSim } from '../store/simStore'
import { useUi } from '../store/uiStore'
import { clearAll } from '../utils/storage'

export default function SettingsPage() {
  const { t, theme, setTheme, motion, setMotion, quality, setQuality } = usePrefs()
  const { session, signOut } = useAuth()
  const sim = useSim((s) => s.sim)
  const reset = useSim((s) => s.reset)
  const toast = useUi((s) => s.toast)
  const navigate = useNavigate()
  const [seed, setSeed] = useState(String(sim.seed))
  const [confirm, setConfirm] = useState<null | 'reset' | 'clear'>(null)
  const seedValid = /^\d{1,9}$/.test(seed)

  return (
    <div className="page narrow">
      <header className="page-head">
        <h1>{t('settings.title')}</h1>
      </header>

      <Panel title={t('settings.appearance')} id="appearance">
        <div className="settings-grid">
          <span id="theme-l">{t('settings.theme')}</span>
          <div className="seg" role="group" aria-labelledby="theme-l">
            <button className={theme === 'dark' ? 'on' : ''} aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>
              {t('settings.dark')}
            </button>
            <button className={theme === 'light' ? 'on' : ''} aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>
              {t('settings.light')}
            </button>
          </div>
          <span>{t('settings.language')}</span>
          <LanguageSelector full />
          <span id="motion-l">{t('settings.motion')}</span>
          <div className="seg" role="group" aria-labelledby="motion-l">
            {(['system', 'reduce', 'full'] as Motion[]).map((m) => (
              <button key={m} className={motion === m ? 'on' : ''} aria-pressed={motion === m} onClick={() => setMotion(m)}>
                {t(`settings.motion.${m}`)}
              </button>
            ))}
          </div>
          <span id="q-l">{t('settings.quality')}</span>
          <div className="seg" role="group" aria-labelledby="q-l">
            {(['auto', 'low', 'high'] as Quality[]).map((q) => (
              <button key={q} className={quality === q ? 'on' : ''} aria-pressed={quality === q} onClick={() => setQuality(q)}>
                {t(`settings.quality.${q}`)}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      <Panel title={t('settings.simulation')} id="simulation">
        <div className="settings-grid">
          <span>{t('status.speed')}</span>
          <SimControls />
          <label htmlFor="seed">{t('settings.seed')}</label>
          <form
            className="row-gap"
            onSubmit={(e) => {
              e.preventDefault()
              if (!seedValid) return
              reset(Number(seed))
              toast(`${t('sim.reset')} · ${seed}`, 'ok')
            }}
          >
            <input id="seed" inputMode="numeric" value={seed} onChange={(e) => setSeed(e.target.value)} aria-invalid={!seedValid || undefined} aria-describedby="seed-help" className="mono" />
            <button className="btn" disabled={!seedValid}>
              {t('settings.applySeed')}
            </button>
          </form>
        </div>
        <p className="hint" id="seed-help">{t('settings.seedHelp')}</p>
        <button className="btn warn" onClick={() => setConfirm('reset')}>
          <RotateCcw size={15} aria-hidden /> {t('sim.reset')}
        </button>
      </Panel>

      <Panel title={<><Database size={16} aria-hidden /> {t('settings.data')}</>} id="data">
        <dl className="data-table">
          <dt>{t('settings.local')}</dt>
          <dd>{t('settings.localItems')}</dd>
          <dt>{t('settings.session')}</dt>
          <dd>{t('settings.sessionItems')}</dd>
          <dt>{t('settings.remote')}</dt>
          <dd>{t('settings.remoteItems')}</dd>
          <dt>{t('settings.fictional')}</dt>
          <dd>{t('settings.fictionalItems')}</dd>
        </dl>
        <p className="notice small">{t('auth.localNotice')}</p>
        <button className="btn danger" onClick={() => setConfirm('clear')}>
          <Trash2 size={15} aria-hidden /> {t('settings.clear')}
        </button>
      </Panel>

      {session && (
        <Panel title={t('settings.account')} id="account">
          <p>{t('auth.signedInAs', { name: session.name })}</p>
          <p className="muted small">{session.mode === 'demo' ? t('auth.modeDemo') : `${t('auth.modeLocal')} · ${session.email}`}</p>
          <button
            className="btn"
            onClick={() => {
              signOut()
              navigate('/login')
            }}
          >
            <LogOut size={15} aria-hidden /> {t('auth.signOut')}
          </button>
        </Panel>
      )}

      {confirm === 'reset' && <ConfirmDialog text={t('sim.resetConfirm')} danger onClose={() => setConfirm(null)} onConfirm={() => reset()} />}
      {confirm === 'clear' && (
        <ConfirmDialog
          text={t('settings.clearConfirm')}
          danger
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            disablePersistence()
            clearAll()
            window.location.replace('/login')
          }}
        />
      )}
    </div>
  )
}
