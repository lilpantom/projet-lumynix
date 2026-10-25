import { LogOut, Settings, User } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { usePrefs } from '../../context/PreferencesContext'

export function UserMenu() {
  const { session, signOut } = useAuth()
  const { t } = usePrefs()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
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
  if (!session) return null
  return (
    <div className="popover-wrap" ref={ref}>
      <button className="icon-btn avatar" aria-label={t('top.userMenu')} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <User size={18} />
      </button>
      {open && (
        <div className="popover user-pop" role="menu">
          <div className="popover-head column">
            <strong>{t('auth.signedInAs', { name: session.name })}</strong>
            <small className="muted">{session.mode === 'demo' ? t('auth.modeDemo') : t('auth.modeLocal')}</small>
          </div>
          <Link role="menuitem" className="menu-item" to="/settings" onClick={() => setOpen(false)}>
            <Settings size={16} /> {t('nav.settings')}
          </Link>
          <button
            role="menuitem"
            className="menu-item"
            onClick={() => {
              signOut()
              navigate('/login')
            }}
          >
            <LogOut size={16} /> {t('auth.signOut')}
          </button>
        </div>
      )}
    </div>
  )
}
