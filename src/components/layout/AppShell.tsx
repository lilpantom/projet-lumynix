import { Activity, Gauge, LayoutDashboard, Menu, Radar, Rocket, Settings, Wrench, X } from 'lucide-react'
import { Suspense, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { usePrefs } from '../../context/PreferencesContext'
import { useSimClock } from '../../hooks/useSimClock'
import { useSim } from '../../store/simStore'
import { ErrorBoundary } from '../common/ErrorBoundary'
import { Toaster } from '../common/Toaster'
import { LanguageSelector } from './LanguageSelector'
import { NotificationCenter } from './NotificationCenter'
import { ShipSearch } from './ShipSearch'
import { StatusBar } from './StatusBar'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'

const NAV = [
  { to: '/dashboard', key: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/ships', key: 'nav.ships', icon: Rocket },
  { to: '/traffic', key: 'nav.traffic', icon: Radar },
  { to: '/maintenance', key: 'nav.maintenance', icon: Wrench },
  { to: '/crew', key: 'nav.crew', icon: Activity },
  { to: '/settings', key: 'nav.settings', icon: Settings },
] as const

export function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
      <ellipse cx="16" cy="16" rx="13" ry="6" fill="none" stroke="currentColor" strokeWidth="1.4" transform="rotate(-25 16 16)" opacity=".7" />
      <circle cx="16" cy="16" r="4" fill="currentColor" />
      <circle cx="27" cy="11" r="2" fill="var(--amber)" />
    </svg>
  )
}

export function AppShell() {
  useSimClock()
  const { t } = usePrefs()
  const [drawer, setDrawer] = useState(false)
  const { pathname } = useLocation()
  const conflicts = useSim((s) => s.sim.conflicts)
  const crit = conflicts.filter((c) => c.severity === 'crit').length
  useEffect(() => setDrawer(false), [pathname])

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        {t('app.skip')}
      </a>
      <header className="topbar">
        <button className="icon-btn only-mobile" onClick={() => setDrawer(true)} aria-label={t('nav.menu')}>
          <Menu size={20} />
        </button>
        <NavLink to="/dashboard" className="brand">
          <Logo />
          <span className="brand-name">{t('app.name')}</span>
          <span className="brand-tag hide-tablet">{t('app.tagline')}</span>
        </NavLink>
        <ShipSearch />
        <div className="topbar-actions">
          <NotificationCenter />
          <LanguageSelector />
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      <nav className={`navrail${drawer ? ' open' : ''}`} aria-label={t('app.name')}>
        <button className="icon-btn only-mobile drawer-x" onClick={() => setDrawer(false)} aria-label={t('nav.closeMenu')}>
          <X size={20} />
        </button>
        {NAV.map(({ to, key, icon: Icon }) => (
          <NavLink key={to} to={to} className="nav-item" title={t(key)}>
            <Icon size={19} aria-hidden />
            <span className="nav-label">{t(key)}</span>
            {to === '/traffic' && conflicts.length > 0 && (
              <span className={`nav-count ${crit ? 'risk-crit' : 'risk-warn'}`} aria-label={`${conflicts.length}`}>
                {conflicts.length}
              </span>
            )}
          </NavLink>
        ))}
        <div className="nav-foot">
          <Gauge size={14} aria-hidden /> <span className="nav-label">{t('app.simulated')}</span>
        </div>
      </nav>
      {drawer && <div className="scrim only-mobile" onClick={() => setDrawer(false)} />}

      <main id="main" className="main" tabIndex={-1}>
        <ErrorBoundary
          key={pathname}
          fallback={(reset) => (
            <div className="page">
              <p className="empty">{t('app.error')}</p>
              <button className="btn" onClick={reset}>
                {t('app.errorRetry')}
              </button>
            </div>
          )}
        >
          <Suspense fallback={<div className="page loading">{t('common.loading')}</div>}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <StatusBar />
      <Toaster />
    </div>
  )
}
