import { Languages } from 'lucide-react'
import { usePrefs } from '../../context/PreferencesContext'
import { isLocale, locales } from '../../i18n'

export function LanguageSelector({ full = false }: { full?: boolean }) {
  const { locale, setLocale, t } = usePrefs()
  return (
    <label className={`lang-select${full ? ' full' : ''}`} title={t('top.language')}>
      <Languages size={16} aria-hidden />
      <span className="sr-only">{t('top.language')}</span>
      <select value={locale} onChange={(e) => isLocale(e.target.value) && setLocale(e.target.value)}>
        {locales.map((l) => (
          <option key={l.id} value={l.id} lang={l.id}>
            {full ? l.label : l.short}
          </option>
        ))}
      </select>
    </label>
  )
}
