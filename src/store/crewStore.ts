import { create } from 'zustand'
import type { Answers } from '../sim/wellbeing'

/**
 * In-memory only (never persisted): the restricted-section acknowledgement and the person's own
 * check-in results. Reloading the page clears everything here by design.
 */
export interface CheckInResult {
  at: number
  answers: Answers
  index: number | null
  flagged: 'safety' | 'distress' | null
}

interface CrewStore {
  gateAcknowledged: boolean
  lastResult: CheckInResult | null
  relaxOpen: boolean
  acknowledgeGate: () => void
  saveResult: (r: CheckInResult) => void
  dismissResult: () => void
  setRelax: (open: boolean) => void
}

export const useCrew = create<CrewStore>((set) => ({
  gateAcknowledged: false,
  lastResult: null,
  relaxOpen: false,
  acknowledgeGate: () => set({ gateAcknowledged: true }),
  saveResult: (lastResult) => set({ lastResult }),
  dismissResult: () => set({ lastResult: null }),
  setRelax: (relaxOpen) => set({ relaxOpen }),
}))
