import type { SpaceNode } from '../types'

/** Fictional settlements, stations and relays. Anchors (bodies, Lagrange offsets) are real geometry. */
export const NODES: SpaceNode[] = [
  { id: 'CRT', name: 'Carthage Gateway', kind: 'port', body: 'earth', offsetDeg: 0, berths: 6 },
  { id: 'HNB', name: 'Hannibal Depot (Sun–Earth L4)', kind: 'port', body: 'earth', offsetDeg: 60, berths: 3 },
  { id: 'APH', name: 'Aphrodite Aerostat', kind: 'port', body: 'venus', offsetDeg: 0, berths: 2 },
  { id: 'ARS', name: 'Ares Prime', kind: 'port', body: 'mars', offsetDeg: 0, berths: 5 },
  { id: 'VST', name: 'Vesta Mining Camp', kind: 'port', body: 'vesta', offsetDeg: 0, berths: 2 },
  { id: 'CER', name: 'Ceres Hub', kind: 'port', body: 'ceres', offsetDeg: 0, berths: 4 },
  { id: 'GAN', name: 'Ganymede Outpost', kind: 'port', body: 'jupiter', offsetDeg: 0, berths: 3 },
  { id: 'TTN', name: 'Titan Station', kind: 'port', body: 'saturn', offsetDeg: 0, berths: 2 },
  { id: 'R-EL5', name: 'Elissa Relay (Sun–Earth L5)', kind: 'relay', body: 'earth', offsetDeg: -60, berths: 0 },
  { id: 'R-ML4', name: 'Dougga Relay (Sun–Mars L4)', kind: 'relay', body: 'mars', offsetDeg: 60, berths: 0 },
  { id: 'R-ML5', name: 'Kairouan Relay (Sun–Mars L5)', kind: 'relay', body: 'mars', offsetDeg: -60, berths: 0 },
  { id: 'R-JL4', name: 'Tabarka Relay (Sun–Jupiter L4)', kind: 'relay', body: 'jupiter', offsetDeg: 60, berths: 0 },
]

export const NODE_BY_ID: Record<string, SpaceNode> = Object.fromEntries(NODES.map((n) => [n.id, n]))
export const PORTS = NODES.filter((n) => n.kind === 'port')
export const RELAYS = NODES.filter((n) => n.kind === 'relay')
