import { Home, Pause, Play, Volume2, VolumeX, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { usePrefs } from '../../context/PreferencesContext'
import type { TranslationKey } from '../../i18n'
import { useCrew } from '../../store/crewStore'

type Scene = 'forest' | 'ocean' | 'mountains'

/** Generated vector landscapes (no external images, so they work offline). */
function Landscape({ scene }: { scene: Scene }) {
  if (scene === 'ocean')
    return (
      <svg viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice" className="landscape" aria-hidden>
        <defs>
          <linearGradient id="sky-o" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f6c79a" />
            <stop offset="0.55" stopColor="#f3e2c6" />
            <stop offset="1" stopColor="#9fd0dc" />
          </linearGradient>
        </defs>
        <rect width="800" height="450" fill="url(#sky-o)" />
        <circle cx="560" cy="210" r="46" fill="#ffe7b8" opacity=".9" />
        <rect y="240" width="800" height="210" fill="#2f7f98" />
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} className={`wave w${i}`} d={`M0 ${262 + i * 38} q50 -12 100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 V450 H0Z`} fill={['#3a91aa', '#2c7a93', '#24697f', '#1c586c', '#154759'][i]} opacity=".9" />
        ))}
      </svg>
    )
  if (scene === 'mountains')
    return (
      <svg viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice" className="landscape" aria-hidden>
        <defs>
          <linearGradient id="sky-m" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#a9c6e8" />
            <stop offset="1" stopColor="#e9eef5" />
          </linearGradient>
        </defs>
        <rect width="800" height="450" fill="url(#sky-m)" />
        <path d="M0 300 L120 170 L200 240 L330 110 L450 250 L560 150 L680 260 L800 180 V450 H0Z" fill="#7d93b2" />
        <path d="M330 110 L365 150 L340 145 L320 160 L300 140Z M560 150 L590 180 L570 178 L550 190 L535 175Z" fill="#f4f7fb" />
        <path d="M0 340 L150 250 L260 320 L400 230 L520 330 L650 260 L800 330 V450 H0Z" fill="#5b7392" />
        <path d="M0 390 Q200 330 400 380 T800 370 V450 H0Z" fill="#3f5a5a" />
      </svg>
    )
  return (
    <svg viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice" className="landscape" aria-hidden>
      <defs>
        <linearGradient id="sky-f" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cfe6d2" />
          <stop offset="1" stopColor="#eef5e6" />
        </linearGradient>
      </defs>
      <rect width="800" height="450" fill="url(#sky-f)" />
      <g className="sunrays" opacity=".35">
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={`M${180 + i * 120} 0 L${120 + i * 120} 450 L${170 + i * 120} 450Z`} fill="#fffbe0" />
        ))}
      </g>
      <path d="M0 330 Q200 280 400 320 T800 300 V450 H0Z" fill="#8bb38a" />
      {Array.from({ length: 16 }, (_, i) => {
        const x = (i * 53) % 800
        const h = 120 + ((i * 37) % 80)
        const base = 360 + ((i * 13) % 40)
        return (
          <g key={i} className="tree">
            <rect x={x - 4} y={base - 20} width="8" height="40" fill="#5b4632" />
            <path d={`M${x} ${base - h} L${x + 34} ${base - 10} L${x - 34} ${base - 10}Z`} fill={i % 2 ? '#2f6b45' : '#3c7d52'} />
          </g>
        )
      })}
      <path d="M0 400 Q200 370 400 395 T800 390 V450 H0Z" fill="#4c7a4a" />
    </svg>
  )
}

/** Opt-in ambient noise synthesised with Web Audio (filtered noise with a slow swell). */
function useAmbient(scene: Scene, on: boolean) {
  useEffect(() => {
    if (!on) return
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const len = ctx.sampleRate * 4
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      // Brown-ish noise: integrated white noise.
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
      data[i] = last * 3.5
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = scene === 'mountains' ? 'bandpass' : 'lowpass'
    filter.frequency.value = scene === 'ocean' ? 700 : scene === 'forest' ? 1400 : 500
    const gain = ctx.createGain()
    gain.gain.value = 0.25
    const lfo = ctx.createOscillator()
    lfo.frequency.value = scene === 'ocean' ? 0.12 : 0.05
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.15
    lfo.connect(lfoGain).connect(gain.gain)
    src.connect(filter).connect(gain).connect(ctx.destination)
    src.start()
    lfo.start()
    return () => {
      src.stop()
      lfo.stop()
      void ctx.close()
    }
  }, [scene, on])
}

const PHASES: { key: TranslationKey; secs: number; scale: number }[] = [
  { key: 'relax.inhale', secs: 4, scale: 1 },
  { key: 'relax.hold', secs: 4, scale: 1 },
  { key: 'relax.exhale', secs: 6, scale: 0.55 },
]

function Breathing() {
  const { t, reducedMotion } = usePrefs()
  const [on, setOn] = useState(false)
  const [{ phase, left }, setState] = useState({ phase: 0, left: PHASES[0].secs })
  useEffect(() => {
    if (!on) return
    const id = window.setInterval(
      () =>
        setState((s) => {
          if (s.left > 1) return { ...s, left: s.left - 1 }
          const next = (s.phase + 1) % PHASES.length
          return { phase: next, left: PHASES[next].secs }
        }),
      1000,
    )
    return () => window.clearInterval(id)
  }, [on])
  const p = PHASES[phase]
  return (
    <section className="relax-card">
      <h3>{t('relax.breathing')}</h3>
      <div className="breath-wrap">
        <div
          className="breath-circle"
          style={reducedMotion ? undefined : { transform: `scale(${on ? p.scale : 0.7})`, transitionDuration: `${p.secs}s` }}
          aria-hidden
        />
        <p className="breath-text" aria-live="polite">
          {on ? `${t(p.key)} · ${left}` : ''}
        </p>
      </div>
      <button
        className="btn"
        onClick={() => {
          setOn((o) => !o)
          setState({ phase: 0, left: PHASES[0].secs })
        }}
      >
        {on ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />} {on ? t('relax.stopBreathing') : t('relax.startBreathing')}
      </button>
    </section>
  )
}

function Grounding() {
  const { t } = usePrefs()
  const [i, setI] = useState(0)
  const steps = [5, 4, 3, 2, 1]
  return (
    <section className="relax-card">
      <h3>{t('relax.grounding')}</h3>
      <p className="grounding-step" aria-live="polite">
        {t(`relax.g.${steps[i]}` as TranslationKey)}
      </p>
      {i < steps.length - 1 ? (
        <button className="btn" onClick={() => setI(i + 1)}>
          {t('relax.next')}
        </button>
      ) : (
        <button className="btn" onClick={() => setI(0)}>
          {t('relax.restart')}
        </button>
      )}
    </section>
  )
}

function BreakTimer() {
  const { t, num } = usePrefs()
  const [minutes, setMinutes] = useState(5)
  const [endAt, setEndAt] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!endAt) return
    const id = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [endAt])
  const left = endAt ? Math.max(0, endAt - now) : minutes * 60_000
  const done = endAt !== null && left === 0
  const mm = Math.floor(left / 60_000)
  const ss = Math.floor((left % 60_000) / 1000)
  return (
    <section className="relax-card">
      <h3>{t('relax.timer')}</h3>
      <div className="seg" role="group" aria-label={t('relax.timer')}>
        {[2, 5, 10].map((m) => (
          <button key={m} className={minutes === m ? 'on' : ''} aria-pressed={minutes === m} onClick={() => (setMinutes(m), setEndAt(null))}>
            {t('relax.minutes', { n: num(m) })}
          </button>
        ))}
      </div>
      <p className="timer mono" role="timer" aria-live="off">
        {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
      </p>
      {done && <p role="status">{t('relax.timerDone')}</p>}
      <button className="btn" onClick={() => (endAt ? setEndAt(null) : (setNow(Date.now()), setEndAt(Date.now() + minutes * 60_000)))}>
        {endAt ? t('relax.timerStop') : t('relax.timerStart')}
      </button>
    </section>
  )
}

/** Full-screen, voluntary relaxation break. Sound is off by default. No scent output exists or is claimed. */
export function RelaxationMode() {
  const { t } = usePrefs()
  const setRelax = useCrew((s) => s.setRelax)
  const navigate = useNavigate()
  const [scene, setScene] = useState<Scene>('forest')
  const [sound, setSound] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useAmbient(scene, sound)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('button')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setRelax(false)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [setRelax])

  return (
    <div className="relax" role="dialog" aria-modal="true" aria-label={t('relax.title')} ref={ref}>
      <Landscape scene={scene} />
      <div className="relax-ui">
        <header className="relax-head">
          <h2>{t('relax.title')}</h2>
          <div className="seg" role="group" aria-label={t('relax.scene')}>
            {(['forest', 'ocean', 'mountains'] as Scene[]).map((s) => (
              <button key={s} className={scene === s ? 'on' : ''} aria-pressed={scene === s} onClick={() => setScene(s)}>
                {t(`relax.${s}`)}
              </button>
            ))}
          </div>
          <button className="btn" onClick={() => setSound((x) => !x)} aria-pressed={sound} title={t('relax.soundNote')}>
            {sound ? <Volume2 size={15} aria-hidden /> : <VolumeX size={15} aria-hidden />} {sound ? t('relax.soundOn') : t('relax.soundOff')}
          </button>
          <button className="icon-btn" onClick={() => setRelax(false)} aria-label={t('common.close')}>
            <X size={18} />
          </button>
        </header>
        <div className="relax-grid">
          <Breathing />
          <Grounding />
          <BreakTimer />
        </div>
        <footer className="relax-foot">
          <p className="small">{t('relax.noScent')}</p>
          <button
            className="btn primary"
            onClick={() => {
              setRelax(false)
              navigate('/dashboard')
            }}
          >
            <Home size={15} aria-hidden /> {t('relax.return')}
          </button>
        </footer>
      </div>
    </div>
  )
}
