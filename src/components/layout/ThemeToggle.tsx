import { Moon, Sun } from 'lucide-react'
import { usePrefs } from '../../context/PreferencesContext'

export function ThemeToggle() {
  const { theme, toggleTheme, t } = usePrefs()
  const label = theme === 'dark' ? t('top.toLight') : t('top.toDark')
  return (
    <button className="icon-btn" onClick={toggleTheme} aria-label={label} title={label}>
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
