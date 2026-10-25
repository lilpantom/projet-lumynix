import type { Locale } from '../types'
import { ar } from './ar'
import { en, type Dictionary, type TranslationKey } from './en'
import { fr } from './fr'

export type { TranslationKey }

export const locales: { id: Locale; label: string; short: string }[] = [
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'fr', label: 'Français', short: 'FR' },
  { id: 'ar', label: 'العربية', short: 'ع' },
]

export const dictionaries: Record<Locale, Dictionary> = { en, fr, ar }

/** BCP 47 tags for Intl formatting; Tunisia first. */
export const intlLocale: Record<Locale, string> = { en: 'en-GB', fr: 'fr-TN', ar: 'ar-TN' }

export const isLocale = (value: unknown): value is Locale => value === 'en' || value === 'fr' || value === 'ar'

export type TranslateParams = Record<string, string | number>

export function translate(locale: Locale, key: TranslationKey, params?: TranslateParams): string {
  const template = dictionaries[locale][key] ?? en[key] ?? key
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match))
}

/** For keys built at runtime (enums, event keys). Falls back to the key itself. */
export function hasKey(key: string): key is TranslationKey {
  return key in en
}
