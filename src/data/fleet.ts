import type { CargoCategory, MissionType, Priority } from '../types'

/** Fictional fleet. Timing is relative to the scenario start, in hours. */
export interface FleetSeed {
  id: string
  name: string
  missionType: MissionType
  cargo: CargoCategory
  priority: Priority
  origin: string
  dest: string
  /** Hours from scenario start (negative = already departed). */
  departH: number
  /** Transit duration override in hours; otherwise derived from distance. */
  durationH?: number
  fuel: number
  crew: number
}

export const SCENARIO_START = Date.UTC(2148, 2, 14, 6, 0)

export const FLEET: FleetSeed[] = [
  { id: 'ARES-204', name: 'Ares Meridian', missionType: 'cargo', cargo: 'supplies', priority: 'high', origin: 'CRT', dest: 'ARS', departH: -400, fuel: 46, crew: 4 },
  { id: 'KESTREL-19', name: 'Kestrel', missionType: 'mining', cargo: 'ore', priority: 'normal', origin: 'VST', dest: 'ARS', departH: -700, fuel: 52, crew: 3 },
  { id: 'ORION-315', name: 'Orion Dawn', missionType: 'passenger', cargo: 'passengers', priority: 'high', origin: 'ARS', dest: 'CRT', departH: -260, fuel: 61, crew: 6 },
  { id: 'TITAN-07', name: 'Titan Pathfinder', missionType: 'science', cargo: 'research', priority: 'normal', origin: 'CER', dest: 'TTN', departH: -900, fuel: 17, crew: 5 },
  { id: 'NOVA-42', name: 'Nova Samaritan', missionType: 'medical', cargo: 'medical', priority: 'critical', origin: 'CRT', dest: 'HNB', departH: -40, fuel: 78, crew: 4 },
  { id: 'ELISSA-12', name: 'Elissa', missionType: 'cargo', cargo: 'water', priority: 'normal', origin: 'CER', dest: 'ARS', departH: -500, fuel: 39, crew: 3 },
  { id: 'MAGO-23', name: 'Mago Explorer', missionType: 'science', cargo: 'research', priority: 'low', origin: 'APH', dest: 'CRT', departH: -150, fuel: 70, crew: 2 },
  { id: 'VEGA-11', name: 'Vega Courier', missionType: 'cargo', cargo: 'equipment', priority: 'normal', origin: 'CRT', dest: 'CER', departH: 6, fuel: 92, crew: 3 },
  { id: 'ATLAS-88', name: 'Atlas Heavy', missionType: 'mining', cargo: 'ore', priority: 'low', origin: 'CER', dest: 'CRT', departH: -700, fuel: 33, crew: 4 },
  { id: 'LYRA-61', name: 'Lyra', missionType: 'passenger', cargo: 'passengers', priority: 'normal', origin: 'CRT', dest: 'ARS', departH: 18, fuel: 95, crew: 5 },
  { id: 'PHOENIX-30', name: 'Phoenix Relay Tender', missionType: 'cargo', cargo: 'equipment', priority: 'high', origin: 'ARS', dest: 'GAN', departH: -1100, fuel: 44, crew: 4 },
  { id: 'DIDO-77', name: 'Dido', missionType: 'medical', cargo: 'medical', priority: 'high', origin: 'HNB', dest: 'CER', departH: -120, fuel: 66, crew: 3 },
  { id: 'SIRIUS-08', name: 'Sirius', missionType: 'cargo', cargo: 'supplies', priority: 'normal', origin: 'GAN', dest: 'CER', departH: -2000, fuel: 22, crew: 3 },
  { id: 'SALAMBO-5', name: 'Salammbô', missionType: 'passenger', cargo: 'passengers', priority: 'normal', origin: 'CRT', dest: 'APH', departH: -1500, durationH: 900, fuel: 58, crew: 4 },
  { id: 'HELIOS-3', name: 'Helios Survey', missionType: 'science', cargo: 'research', priority: 'low', origin: 'ARS', dest: 'CRT', departH: -1800, durationH: 1000, fuel: 49, crew: 3 },
  { id: 'ZEPHYR-56', name: 'Zephyr', missionType: 'cargo', cargo: 'water', priority: 'normal', origin: 'HNB', dest: 'CER', departH: 0, fuel: 71, crew: 3 },
]

/** Planted encounters so the dashboard is useful immediately (all fictional). */
export const PLANTED = {
  /** KESTREL-19 is still gapFraction × threshold out when ARES-204 docks at Ares Prime (terminal-area convergence). */
  arrivalPair: { lead: 'ARES-204', trail: 'KESTREL-19', leadArrivalH: 20, gapFraction: 0.6 },
  /** ZEPHYR-56 is routed to cross ORION-315's path at +crossH, offset sideways by offsetKm. */
  crossing: { base: 'ORION-315', ship: 'ZEPHYR-56', crossH: 34, offsetKm: 120_000, durationH: 600 },
}
