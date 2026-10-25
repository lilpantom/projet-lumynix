import { useEffect } from 'react'
import { TICK_MS, useSim } from '../store/simStore'

/** Owns the single simulation interval; restarts cleanly on pause/resume. */
export function useSimClock() {
  const running = useSim((s) => s.running)
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => useSim.getState().tick(), TICK_MS)
    return () => window.clearInterval(id)
  }, [running])
}
