import { Search } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { usePrefs } from '../../context/PreferencesContext'
import { useSim } from '../../store/simStore'
import { useUi } from '../../store/uiStore'

/** Combobox search by ship name or identifier; Enter/click selects and flies the camera to it. */
export function ShipSearch() {
  const { t } = usePrefs()
  const ships = useSim((s) => s.sim.ships)
  const selectShip = useUi((s) => s.selectShip)
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState(false)
  const listId = useId()
  const matches = useMemo(() => {
    const n = q.trim().toLowerCase()
    if (!n) return []
    return ships.filter((s) => s.id.toLowerCase().includes(n) || s.name.toLowerCase().includes(n)).slice(0, 8)
  }, [q, ships])

  const choose = (id: string) => {
    selectShip(id, true)
    navigate('/dashboard')
    setQ('')
    setOpen(false)
  }

  return (
    <div className="search" role="search">
      <Search size={16} aria-hidden className="search-icon" />
      <input
        type="search"
        role="combobox"
        aria-label={t('top.searchLabel')}
        aria-expanded={open && q.length > 0}
        aria-controls={listId}
        aria-activedescendant={matches[active] ? `${listId}-${matches[active].id}` : undefined}
        placeholder={t('top.search')}
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(a + 1, matches.length - 1)))
          if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)))
          if (e.key === 'Enter' && matches[active]) choose(matches[active].id)
          if (e.key === 'Escape') setOpen(false)
        }}
      />
      {open && q && (
        <ul className="search-results" id={listId} role="listbox">
          {matches.length === 0 && <li className="empty">{t('top.noMatches')}</li>}
          {matches.map((s, i) => (
            <li key={s.id} id={`${listId}-${s.id}`} role="option" aria-selected={i === active} className={i === active ? 'active' : ''} onMouseDown={() => choose(s.id)}>
              <span className="mono">{s.id}</span> <span className="muted">{s.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
