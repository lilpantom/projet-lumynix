import { AlertOctagon, AlertTriangle, CheckCircle2, HelpCircle, X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { usePrefs } from '../../context/PreferencesContext'
import type { RiskLevel } from '../../types'

const RISK_ICON = { ok: CheckCircle2, warn: AlertTriangle, crit: AlertOctagon, unknown: HelpCircle }

/** Risk is always shown as colour + icon + text, never colour alone. */
export function RiskBadge({ level, label, compact = false }: { level: RiskLevel; label?: string; compact?: boolean }) {
  const { t } = usePrefs()
  const Icon = RISK_ICON[level]
  const text = label ?? t(`risk.${level}`)
  return (
    <span className={`badge risk-${level}`} title={compact ? text : undefined}>
      <Icon size={13} aria-hidden />
      {compact ? <span className="sr-only">{text}</span> : text}
    </span>
  )
}

export function SimBadge() {
  const { t } = usePrefs()
  return <span className="badge sim-badge">{t('app.simulated')}</span>
}

export function Panel({ title, actions, children, className = '', id }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={`panel ${className}`} id={id} aria-labelledby={title && id ? `${id}-h` : undefined}>
      {(title || actions) && (
        <header className="panel-head">
          {title && <h2 id={id ? `${id}-h` : undefined}>{title}</h2>}
          {actions && <div className="panel-actions">{actions}</div>}
        </header>
      )}
      <div className="panel-body">{children}</div>
    </section>
  )
}

export function Field({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="field">
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined}>{value}</dd>
    </div>
  )
}

export function Meter({ value, level, label }: { value: number; level: RiskLevel; label: string }) {
  return (
    <div className={`meter risk-${level}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} aria-label={label}>
      <span style={{ inlineSize: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>
}

/** Accessible modal dialog: focus trap-lite (initial focus + Escape + restore focus). */
export function Dialog({ title, onClose, children, footer, wide = false }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const { t } = usePrefs()
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const el = ref.current
    el?.querySelector<HTMLElement>('input, select, textarea, button:not(.dialog-x)')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && el) {
        const items = el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus())
        else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus())
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [onClose])
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`dialog${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id}>
        <header className="dialog-head">
          <h2 id={id}>{title}</h2>
          <button className="icon-btn dialog-x" onClick={onClose} aria-label={t('common.close')}>
            <X size={18} />
          </button>
        </header>
        <div className="dialog-body">{children}</div>
        {footer && <footer className="dialog-foot">{footer}</footer>}
      </div>
    </div>
  )
}

export function ConfirmDialog({ text, onConfirm, onClose, danger = false }: { text: string; onConfirm: () => void; onClose: () => void; danger?: boolean }) {
  const { t } = usePrefs()
  return (
    <Dialog
      title={t('common.confirm')}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            className={`btn ${danger ? 'danger' : 'primary'}`}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {t('common.confirm')}
          </button>
        </>
      }
    >
      <p>{text}</p>
    </Dialog>
  )
}
