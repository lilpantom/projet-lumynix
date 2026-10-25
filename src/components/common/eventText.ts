import { NODE_BY_ID } from '../../data/nodes'
import { hasKey, type TranslateParams, type TranslationKey } from '../../i18n'
import type { RouteCandidate } from '../../sim/routing'

type Prefs = { t: (k: TranslationKey, p?: TranslateParams) => string; num: (n: number, d?: number) => string; dt: (t: number) => string }

/** Translates a stored event (key + raw params) into the active language. */
export function eventText(key: string, params: Record<string, string | number>, p: Prefs): string {
  if (!hasKey(key)) return key
  const out: TranslateParams = { ...params }
  if (typeof params.component === 'string' && hasKey(`comp.${params.component}`)) out.component = p.t(`comp.${params.component}` as TranslationKey)
  if (typeof params.sepKm === 'number') out.sepKm = p.t('common.km', { n: p.num(params.sepKm) })
  if (typeof params.at === 'number') out.at = p.dt(params.at)
  if (typeof params.action === 'string' && hasKey(params.action)) out.action = p.t(params.action, { h: params.h ?? '', node: NODE_BY_ID[String(params.node)]?.name ?? params.node ?? '' })
  return p.t(key, out)
}

export function candidateLabel(c: Pick<RouteCandidate, 'kind' | 'viaNodeIds' | 'delayH'>, t: Prefs['t']) {
  return t(`route.kind.${c.kind}` as TranslationKey, {
    h: Math.abs(Math.round(c.delayH)),
    node: c.viaNodeIds.map((id) => NODE_BY_ID[id]?.name ?? id).join(' → '),
  })
}
