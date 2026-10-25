import { DAY_MS, HOUR_MS } from '../data/bodies'
import { intlLocale } from '../i18n'
import type { Locale } from '../types'

const cache = new Map<string, Intl.NumberFormat>()
function nf(locale: Locale, opts: Intl.NumberFormatOptions) {
  const k = locale + JSON.stringify(opts)
  let f = cache.get(k)
  if (!f) cache.set(k, (f = new Intl.NumberFormat(intlLocale[locale], opts)))
  return f
}

export const formatNumber = (n: number, locale: Locale, digits = 0) =>
  nf(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n)

/** Sim times are shown in UTC so every operator sees the same clock. */
export function formatDateTime(t: number, locale: Locale, withYear = false) {
  return new Intl.DateTimeFormat(intlLocale[locale], {
    timeZone: 'UTC',
    year: withYear ? 'numeric' : undefined,
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(t) + ' UTC'
}

export function formatDate(t: number, locale: Locale) {
  return new Intl.DateTimeFormat(intlLocale[locale], { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(t)
}

/** Compact duration: "2 d 4 h", "3 h 20 min", "12 min". */
export function formatDuration(ms: number, locale: Locale) {
  const abs = Math.abs(ms)
  const unit = (unit: string, v: number) => nf(locale, { style: 'unit', unit, unitDisplay: 'narrow', maximumFractionDigits: 0 }).format(v)
  const d = Math.floor(abs / DAY_MS)
  const h = Math.floor((abs % DAY_MS) / HOUR_MS)
  const m = Math.floor((abs % HOUR_MS) / 60_000)
  if (d > 0) return h ? `${unit('day', d)} ${unit('hour', h)}` : unit('day', d)
  if (h > 0) return m ? `${unit('hour', h)} ${unit('minute', m)}` : unit('hour', h)
  return unit('minute', m)
}
