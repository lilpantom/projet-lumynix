import { lazy, useEffect, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { AppShell } from '../components/layout/AppShell'
import { usePrefs } from '../context/PreferencesContext'
import type { TranslationKey } from '../i18n'
import { LoginPage, SignupPage } from '../pages/AuthPages'
import { DashboardPage } from '../pages/DashboardPage'

// Secondary routes are code-split.
const ShipsPage = lazy(() => import('../pages/ShipsPage'))
const ShipDetailPage = lazy(() => import('../pages/ShipDetailPage'))
const TrafficPage = lazy(() => import('../pages/TrafficPage'))
const MaintenancePage = lazy(() => import('../pages/MaintenancePage'))
const CrewPage = lazy(() => import('../pages/CrewPage'))
const SettingsPage = lazy(() => import('../pages/SettingsPage'))
const NotFound = lazy(() => import('../pages/NotFound'))

const TITLES: [RegExp, TranslationKey][] = [
  [/^\/login/, 'auth.signIn'],
  [/^\/signup/, 'auth.signUp'],
  [/^\/dashboard/, 'nav.dashboard'],
  [/^\/ships/, 'nav.ships'],
  [/^\/traffic/, 'nav.traffic'],
  [/^\/maintenance/, 'nav.maintenance'],
  [/^\/crew/, 'nav.crew'],
  [/^\/settings/, 'nav.settings'],
]

function RouteEffects() {
  const { pathname } = useLocation()
  const { t } = usePrefs()
  useEffect(() => {
    const k = TITLES.find(([re]) => re.test(pathname))?.[1]
    document.title = k ? `${t(k)} · ORBITFLOW` : 'ORBITFLOW'
  }, [pathname, t])
  return null
}

/**
 * UI-level route guard. It only controls what the interface shows: with frontend-only auth there is no
 * server enforcing access, and all bundled data is readable by anyone who loads the app.
 */
function RequireAuth({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const location = useLocation()
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  return session ? <Navigate to="/dashboard" replace /> : children
}

function Root() {
  return (
    <>
      <RouteEffects />
      <Outlet />
    </>
  )
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/login', element: <GuestOnly><LoginPage /></GuestOnly> },
      { path: '/signup', element: <GuestOnly><SignupPage /></GuestOnly> },
      {
        element: <RequireAuth><AppShell /></RequireAuth>,
        children: [
          { path: '/', element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/ships', element: <ShipsPage /> },
          { path: '/ships/:shipId', element: <ShipDetailPage /> },
          { path: '/traffic', element: <TrafficPage /> },
          { path: '/maintenance', element: <MaintenancePage /> },
          { path: '/crew', element: <CrewPage /> },
          { path: '/settings', element: <SettingsPage /> },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
])
