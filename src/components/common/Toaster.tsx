import { X } from 'lucide-react'
import { usePrefs } from '../../context/PreferencesContext'
import { useUi } from '../../store/uiStore'

export function Toaster() {
  const toasts = useUi((s) => s.toasts)
  const dismiss = useUi((s) => s.dismissToast)
  const { t } = usePrefs()
  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map((x) => (
        <div key={x.id} className={`toast tone-${x.tone}`}>
          <span>{x.text}</span>
          <button className="icon-btn" onClick={() => dismiss(x.id)} aria-label={t('common.close')}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
