import { Eye, EyeOff, Info, Rocket } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { AuthError, EMAIL_RE, passwordOk } from '../auth/authService'
import { Logo } from '../components/layout/AppShell'
import { LanguageSelector } from '../components/layout/LanguageSelector'
import { ThemeToggle } from '../components/layout/ThemeToggle'
import { config } from '../config'
import { usePrefs } from '../context/PreferencesContext'
import type { TranslationKey } from '../i18n'

function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  const { t } = usePrefs()
  const { startDemo } = useAuth()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/dashboard'
  return (
    <div className="auth-page">
      <div className="auth-tools">
        <LanguageSelector />
        <ThemeToggle />
      </div>
      <main className="auth-card" id="main">
        <div className="auth-brand">
          <Logo />
          <div>
            <strong>{t('app.name')}</strong>
            <small className="muted">{t('app.tagline')}</small>
          </div>
        </div>
        <h1>{title}</h1>
        <p className="notice" role="note">
          <Info size={16} aria-hidden /> {t('auth.localNotice')}
        </p>
        {children}
        {config.demoEnabled && (
          <>
            <div className="divider">
              <span>{t('auth.or')}</span>
            </div>
            <button
              className="btn block"
              onClick={() => {
                startDemo(t('auth.demoUser'))
                navigate(from, { replace: true })
              }}
            >
              <Rocket size={16} aria-hidden /> {t('auth.demo')}
            </button>
            <p className="muted center small">{t('auth.demoDesc')}</p>
          </>
        )}
      </main>
    </div>
  )
}

function PasswordInput({ id, value, onChange, autoComplete, invalid, describedBy }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string; invalid?: boolean; describedBy?: string }) {
  const { t } = usePrefs()
  const [show, setShow] = useState(false)
  return (
    <div className="input-wrap">
      <input id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} aria-invalid={invalid || undefined} aria-describedby={describedBy} required />
      <button type="button" className="icon-btn input-addon" onClick={() => setShow((s) => !s)} aria-label={show ? t('auth.hidePassword') : t('auth.showPassword')} aria-pressed={show}>
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}

const authErrorKey = (e: unknown): TranslationKey =>
  e instanceof AuthError ? (`auth.err.${e.code}` as TranslationKey) : 'auth.err.crypto'

export function LoginPage() {
  const { t } = usePrefs()
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/dashboard'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Partial<Record<'email' | 'password' | 'form', TranslationKey>>>({})
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const next: typeof errors = {}
    if (!EMAIL_RE.test(email.trim())) next.email = 'auth.err.email'
    if (!password) next.password = 'auth.err.password'
    setErrors(next)
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      await signIn(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setErrors({ form: authErrorKey(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title={t('auth.signInTitle')}>
      <form onSubmit={submit} noValidate className="form">
        <div className="form-row">
          <label htmlFor="email">{t('auth.email')}</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-invalid={!!errors.email || undefined} aria-describedby={errors.email ? 'email-err' : undefined} required />
          {errors.email && <p className="field-error" id="email-err">{t(errors.email)}</p>}
        </div>
        <div className="form-row">
          <label htmlFor="password">{t('auth.password')}</label>
          <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="current-password" invalid={!!errors.password} describedBy={errors.password ? 'pw-err' : undefined} />
          {errors.password && <p className="field-error" id="pw-err">{t(errors.password)}</p>}
        </div>
        {errors.form && <p className="form-error" role="alert">{t(errors.form)}</p>}
        <button className="btn primary block" disabled={busy}>
          {busy ? t('common.loading') : t('auth.signIn')}
        </button>
      </form>
      <p className="center small">
        {t('auth.noAccount')} <Link to="/signup" state={{ from }}>{t('auth.signUp')}</Link>
      </p>
    </AuthLayout>
  )
}

export function SignupPage() {
  const { t } = usePrefs()
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [terms, setTerms] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<'email' | 'password' | 'confirm' | 'terms' | 'form', TranslationKey>>>({})
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const next: typeof errors = {}
    if (!EMAIL_RE.test(email.trim())) next.email = 'auth.err.email'
    if (!passwordOk(password)) next.password = 'auth.err.password'
    if (confirm !== password) next.confirm = 'auth.err.mismatch'
    if (!terms) next.terms = 'auth.err.terms'
    setErrors(next)
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      await signUp(email, password, name)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setErrors({ form: authErrorKey(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title={t('auth.signUpTitle')}>
      <form onSubmit={submit} noValidate className="form">
        <div className="form-row">
          <label htmlFor="email">{t('auth.email')}</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-invalid={!!errors.email || undefined} aria-describedby={errors.email ? 'email-err' : undefined} required />
          {errors.email && <p className="field-error" id="email-err">{t(errors.email)}</p>}
        </div>
        <div className="form-row">
          <label htmlFor="name">{t('auth.displayName')}</label>
          <input id="name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoComplete="nickname" />
        </div>
        <div className="form-row">
          <label htmlFor="password">{t('auth.password')}</label>
          <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="new-password" invalid={!!errors.password} describedBy="pw-hint" />
          <p className={errors.password ? 'field-error' : 'hint'} id="pw-hint">{t(errors.password ?? 'auth.passwordHint')}</p>
        </div>
        <div className="form-row">
          <label htmlFor="confirm">{t('auth.confirmPassword')}</label>
          <PasswordInput id="confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" invalid={!!errors.confirm} describedBy={errors.confirm ? 'cf-err' : undefined} />
          {errors.confirm && <p className="field-error" id="cf-err">{t(errors.confirm)}</p>}
        </div>
        <div className="form-row">
          <label className="check">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} aria-invalid={!!errors.terms || undefined} aria-describedby={errors.terms ? 'terms-err' : undefined} />
            <span>{t('auth.terms')}</span>
          </label>
          {errors.terms && <p className="field-error" id="terms-err">{t(errors.terms)}</p>}
        </div>
        {errors.form && <p className="form-error" role="alert">{t(errors.form)}</p>}
        <button className="btn primary block" disabled={busy}>
          {busy ? t('common.loading') : t('auth.signUp')}
        </button>
      </form>
      <p className="center small">
        {t('auth.haveAccount')} <Link to="/login">{t('auth.signIn')}</Link>
      </p>
    </AuthLayout>
  )
}
