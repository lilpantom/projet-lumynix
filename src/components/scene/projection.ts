import type { RiskLevel, Theme, Vec2 } from '../../types'

/**
 * Display projection shared by the 2D and 3D views. Heliocentric AU positions are kept in direction,
 * but radial distance is compressed (r_display = K·r^0.55) so Mercury and Saturn fit on one screen.
 * The UI labels the map as not to scale.
 */
const K = 60
const EXP = 0.55

export function toDisplay(p: Vec2): Vec2 {
  const r = Math.hypot(p.x, p.y)
  if (r === 0) return { x: 0, y: 0 }
  const k = (K * Math.pow(r, EXP)) / r
  return { x: p.x * k, y: p.y * k }
}

export const displayRadius = (au: number) => K * Math.pow(au, EXP)

export interface SceneColors {
  bg: string
  orbit: string
  grid: string
  route: string
  routeFlown: string
  selected: string
  label: string
  risk: Record<RiskLevel, string>
  port: string
  relay: string
  relayDown: string
}

export function sceneColors(theme: Theme): SceneColors {
  return theme === 'dark'
    ? {
        bg: '#04070f',
        orbit: '#1f3150',
        grid: '#0f1a2c',
        route: '#3b6a9a',
        routeFlown: '#2a4466',
        selected: '#38c6f4',
        label: '#cfdaea',
        risk: { ok: '#3ddc97', warn: '#f2b648', crit: '#ff5a6a', unknown: '#8a96aa' },
        port: '#a98bff',
        relay: '#38c6f4',
        relayDown: '#5d6878',
      }
    : {
        bg: '#eef2f8',
        orbit: '#b4c2d8',
        grid: '#dde4ef',
        route: '#6f8fb8',
        routeFlown: '#9fb2cc',
        selected: '#0a7fb8',
        label: '#1a2638',
        risk: { ok: '#0f8a5a', warn: '#b36b00', crit: '#c62839', unknown: '#6b7687' },
        port: '#6a46d8',
        relay: '#0a7fb8',
        relayDown: '#9aa4b2',
      }
}
