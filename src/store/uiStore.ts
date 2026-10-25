import { create } from 'zustand'
import type { MissionStatus, MissionType, RiskLevel } from '../types'
import { readJson, writeJson } from '../utils/storage'

export type SortKey = 'id' | 'eta' | 'fuel' | 'risk'
export interface Filters {
  query: string
  destination: string
  mission: MissionType | ''
  status: MissionStatus | ''
  risk: RiskLevel | ''
  sort: SortKey
  desc: boolean
}

export const EMPTY_FILTERS: Filters = { query: '', destination: '', mission: '', status: '', risk: '', sort: 'risk', desc: true }

export interface Overlays {
  trajectories: boolean
  labels: boolean
  telemetry: boolean
}

export interface Toast {
  id: number
  text: string
  tone: 'info' | 'ok' | 'warn'
}

interface UiStore {
  selectedShipId: string | null
  selectedNodeId: string | null
  /** Bumped to ask the scene to fly to the selection (or reset when target is null). */
  focusNonce: number
  focusTarget: 'selection' | 'home'
  view: '3d' | '2d'
  overlays: Overlays
  filters: Filters
  toasts: Toast[]
  selectShip: (id: string | null, focus?: boolean) => void
  selectNode: (id: string | null) => void
  focus: (target: 'selection' | 'home') => void
  setView: (v: '3d' | '2d') => void
  toggleOverlay: (k: keyof Overlays) => void
  setFilters: (f: Partial<Filters>) => void
  toast: (text: string, tone?: Toast['tone']) => void
  dismissToast: (id: number) => void
}

const saved = readJson('ui') as Partial<Pick<UiStore, 'view' | 'overlays' | 'filters'>> | null
const savedView = saved?.view === '2d' ? '2d' : '3d'
const savedOverlays: Overlays = { trajectories: true, labels: true, telemetry: true, ...(typeof saved?.overlays === 'object' ? saved.overlays : {}) }
const savedFilters: Filters = { ...EMPTY_FILTERS, ...(typeof saved?.filters === 'object' ? saved.filters : {}), query: '' }

let toastSeq = 0

export const useUi = create<UiStore>((set) => ({
  selectedShipId: null,
  selectedNodeId: null,
  focusNonce: 0,
  focusTarget: 'home',
  view: savedView,
  overlays: savedOverlays,
  filters: savedFilters,
  toasts: [],
  selectShip: (id, focus = false) =>
    set((s) => ({ selectedShipId: id, selectedNodeId: null, ...(focus && id ? { focusNonce: s.focusNonce + 1, focusTarget: 'selection' as const } : {}) })),
  selectNode: (id) => set({ selectedNodeId: id, selectedShipId: null }),
  focus: (target) => set((s) => ({ focusNonce: s.focusNonce + 1, focusTarget: target })),
  setView: (view) => set({ view }),
  toggleOverlay: (k) => set((s) => ({ overlays: { ...s.overlays, [k]: !s.overlays[k] } })),
  setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
  toast: (text, tone = 'info') => {
    const id = ++toastSeq
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, tone }] }))
    window.setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 4500)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}))

useUi.subscribe((s, p) => {
  if (s.view !== p.view || s.overlays !== p.overlays || s.filters !== p.filters) writeJson('ui', { view: s.view, overlays: s.overlays, filters: s.filters })
})
