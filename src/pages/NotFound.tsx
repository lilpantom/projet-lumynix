import { Link } from 'react-router'
import { usePrefs } from '../context/PreferencesContext'

export default function NotFound() {
  const { t } = usePrefs()
  return (
    <div className="page">
      <h1>{t('notfound.title')}</h1>
      <Link className="btn" to="/dashboard">
        {t('notfound.back')}
      </Link>
    </div>
  )
}
