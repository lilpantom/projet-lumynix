import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isLocale, translate, type TranslateParams, type TranslationKey } from '../i18n'
import type { Locale, Theme } from '../types'
import { formatDateTime, formatDuration, formatNumber } from '../utils/format'
import { readJson, writeJson } from '../utils/storage'

export type Motion = 'system' | 'reduce' | 'full'
export type Quality = 'auto' | 'low' | 'high'

interface PreferencesValue {
  theme: Theme
  setTheme: (t: Theme) => void
  toggleTheme: () => void
  locale: Locale
  setLocale: (l: Locale) => void
  dir: 'ltr' | 'rtl'
  motion: Motion
  setMotion: (m: Motion) => void
  reducedMotion: boolean
  quality: Quality
  setQuality: (q: Quality) => void
  t: (key: TranslationKey, params?: TranslateParams) => string
  num: (n: number, digits?: number) => string
  dt: (t: number, withYear?: boolean) => string
  dur: (ms: number) => string
}

const Ctx = createContext<PreferencesValue | null>(null)

const isTheme = (v: unknown): v is Theme => v === 'dark' || v === 'light'
const isMotion = (v: unknown): v is Motion => v === 'system' || v === 'reduce' || v === 'full'
const isQuality = (v: unknown): v is Quality => v === 'auto' || v === 'low' || v === 'high'

function initialTheme(): Theme {
  const saved = readJson('theme')
  if (isTheme(saved)) return saved
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function initialLocale(): Locale {
  const saved = readJson('lang')
  if (isLocale(saved)) return saved
  const nav = (navigator.language || 'en').slice(0, 2)
  return isLocale(nav) ? nav : 'en'
}

function load<T>(key: string, guard: (v: unknown) => v is T, fallback: T): T {
  const v = readJson(key)
  return guard(v) ? v : fallback
}

function useSystemReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [locale, setLocale] = useState<Locale>(initialLocale)
  const [motion, setMotion] = useState<Motion>(() => load('motion', isMotion, 'system'))
  const [quality, setQuality] = useState<Quality>(() => load('quality', isQuality, 'auto'))
  const systemReduced = useSystemReducedMotion()
  const reducedMotion = motion === 'reduce' || (motion === 'system' && systemReduced)
  const dir = locale === 'ar' ? 'rtl' : 'ltr'

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#060a14' : '#f4f6fa')
    writeJson('theme', theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = dir
    writeJson('lang', locale)
  }, [locale, dir])

  useEffect(() => {
    document.documentElement.dataset.motion = reducedMotion ? 'reduce' : 'full'
    writeJson('motion', motion)
  }, [motion, reducedMotion])

  useEffect(() => void writeJson('quality', quality), [quality])

  const toggleTheme = useCallback(() => setTheme((x) => (x === 'dark' ? 'light' : 'dark')), [])

  const value = useMemo<PreferencesValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      locale,
      setLocale,
      dir,
      motion,
      setMotion,
      reducedMotion,
      quality,
      setQuality,
      t: (key, params) => translate(locale, key, params),
      num: (n, digits = 0) => formatNumber(n, locale, digits),
      dt: (t, withYear) => formatDateTime(t, locale, withYear),
      dur: (ms) => formatDuration(ms, locale),
    }),
    [theme, toggleTheme, locale, dir, motion, reducedMotion, quality],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function usePrefs() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePrefs must be used inside PreferencesProvider')
  return ctx
}
