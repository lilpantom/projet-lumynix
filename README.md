# ORBITFLOW — space traffic intelligence (demo)

A Flightradar24-style dashboard for interplanetary traffic in 2148: an interactive 3D/2D map of the inner and outer solar system, spacecraft tracking, a trajectory HUD, simplified conflict detection with a step-by-step response protocol, explainable route alternatives, a maintenance center, and an optional crew well-being check-in.

**Everything is simulated and fictional.** No backend, no live telemetry, no real tracking networks, no AI model, no medical records. It is not a navigation, collision-avoidance or medical tool.

## Run

```bash
cd orbitflow
npm install
npm run dev         # http://localhost:5173
npm test            # simulation, well-being and i18n tests (vitest)
npm run typecheck   # tsc -b
npm run build       # type-check + production build → dist/
npm run preview     # serve dist/ on http://localhost:4173
```

The build output is static, so any static host works. Configure it to serve `index.html` for unknown paths, because the routes are client-side.

## Environment variables (optional)

Copy `.env.example` to `.env.local`. Only `VITE_` variables reach the browser, and **everything in the bundle is public**. Never put service-role keys or private credentials there.

| Variable | Default | Effect |
| --- | --- | --- |
| `VITE_ENABLE_DEMO` | `true` | `false` hides "Explore in demo mode" on the sign-in page |
| `VITE_AUTH_PROVIDER` | `local` | Reserved for a hosted provider adapter (see below) |

## Routes

| Path | View |
| --- | --- |
| `/login`, `/signup` | Local demo authentication (or demo mode) |
| `/dashboard` | Map-first traffic view: 3D (React Three Fiber) or 2D (SVG), fleet list + filters, inspector / bottom sheet, floating telemetry |
| `/ships` | Directory: search, filters, sort, add/edit with identifier validation |
| `/ships/:shipId` | Full trajectory HUD, telemetry charts, route comparison |
| `/traffic` | Conflict list, detection settings, conflict drill, 7-step response protocol, audit log |
| `/maintenance` | Fleet availability, inspection timeline, component cards (complete / schedule / note / history) |
| `/crew` | Restricted (UI-gated) fictional well-being records, private rule-based check-in, relaxation break |
| `/settings` | Theme, language, motion, 3D quality, seed, reset, data & persistence summary, clear local data |

## Architecture

```
src/
  types/        data model (SimState is plain, serialisable data)
  data/         bodies (real J2000 mean elements), fictional nodes/fleet/crew
  sim/          pure TypeScript, no React:
                orbits · trajectory (Bézier legs) · comms · conflicts (CPA) · routing (candidates, Dijkstra, scoring)
                maintenance (rules) · scenario (seeded) · engine (advance + actions) · selectors · shipId · wellbeing
  auth/         AuthService interface + LocalDemoAuth (PBKDF2 via Web Crypto) + React context
  store/        zustand: simStore (engine wrapper, snapshot persistence), uiStore, crewStore (memory only)
  i18n/         en.ts (source), fr.ts, ar.ts — typed, so a missing key fails the build
  context/      preferences: theme, locale/RTL, motion, quality, Intl formatters
  components/   scene (SpaceScene, Map2D, projection), ships, traffic, maintenance, crew, charts, layout, common
  pages/        route components (secondary routes are lazy-loaded; the 3D scene is a separate chunk)
```

- **Deterministic simulation.** `createScenario(seed)` builds the fleet; `advance(state, ms)` integrates in ≤30-minute sub-steps (fuel burn, component wear, scripted events, departures/arrivals, comms changes) and then recomputes conflicts. The same seed reproduces the same run, which is covered by a test. A single 1 s interval drives the clock; the 3D view interpolates between ticks.
- **Geometry.** Planets move on circular orbits built from real J2000 mean elements (accurate to a few degrees, *not* an ephemeris). Stations and relays are fictional, anchored to real bodies and Sun–planet Lagrange points. Ship paths are quadratic Bézier transfer arcs: illustrative, not Lambert or n-body solutions. The map compresses radial distance (r^0.55) so that Mercury and Saturn fit on one screen, and it is labelled "not to scale".
- **Conflict model (simplified).** For each pair of ships in transit during the horizon, separation is sampled 96 times, then refined by golden-section search. A pair is flagged when separation is below the threshold (default 500,000 km, horizon 72 h) and is critical below 35 % of it. The UI states that this is decision support, not a validated collision prediction.
- **Routing.** Candidates are: the current plan, direct, via each node within a detour limit, the Dijkstra shortest relay path, delay +3/+8 h, expedite −4 h, and a lateral offset away from the closest-approach point. Each is scored as Σ weight × normalised factor (time × priority, fuel, risk, relay coverage, docking load). Weights are adjustable, and every factor is visible.
- **Risk hierarchy.** Green = normal, amber = warning, red = critical, grey = telemetry lost or unverified. Risk is always shown with an icon and text, never colour alone.
- **Planted scenario (seed 2148).** ARES-204/KESTREL-19 converge on Ares Prime (amber). ZEPHYR-56 crosses ORION-315's path (red). ORION-315 loses telemetry at +5 h, NOVA-42's reactor pump wears sharply at +8 h, and the Dougga relay fails at +12 h. "Simulate a conflict" on `/traffic` spawns drill vessels on demand.

## Authentication — what it is and isn't

There is no hosted auth service configured, so the app uses **`LocalDemoAuth`**:

- Accounts live in this browser's `localStorage`. Passwords are never stored in plaintext: they are hashed with PBKDF2-SHA-256 (210,000 iterations, random 16-byte salt, constant-time compare).
- This is **not secure production authentication**. Anyone with access to the browser profile can read or delete the records, and there is no server-side session.
- Route guards (`RequireAuth`, the crew gate) are **UI-level only**. All demo data ships in the bundle, so a frontend guard cannot protect it. Real protection requires server-side enforcement, such as row-level security.

**Adding Supabase later:** install `@supabase/supabase-js`, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the public anon key only; never the service-role key), implement `AuthService` in `src/auth/` with `supabase.auth.signInWithPassword` / `signUp` / `signOut`, and export it as `authService`. Persisting simulation or crew data remotely would also need tables with row-level security policies. Crew data in particular needs explicit consent, a retention policy and role-based access.

## Data & persistence

| Where | What |
| --- | --- |
| `localStorage` (`orbitflow:*`) | theme, language, motion, 3D quality, sim speed, map view/overlays/filters; simulation snapshot (saved at most every 5 s and on unload, validated on load); demo accounts (email, display name, PBKDF2 hash) |
| Memory only | crew-section acknowledgement and well-being check-in answers — cleared on reload, never shown to anyone else |
| Remote | nothing |
| Fictional | all ships, settlements, crew, telemetry, health trends and events |

Settings → "Clear all local data" removes every `orbitflow:*` key.

## Crew well-being — safeguards

- Crew records are synthetic and pseudonymous (IDs and roles only, no names). Heart rate is labelled simulated. Records sit behind a restricted-section gate and never appear in public ship details.
- The check-in is a **transparent rule-based script**; no language model is connected. Every question can be skipped. It says it is not a diagnosis. The "self-reported well-being index" is the mean of the answers given, rescaled to 0–100. Thresholds (`SUPPORT_THRESHOLDS` in `src/sim/wellbeing.ts`: 50 suggests a break, 30 suggests contacting support) only trigger optional supportive suggestions. No labels, fitness decisions or disclosure to supervisors.
- Free text is checked against a small list of en/fr/ar phrases. Distress phrases prompt supportive guidance. Phrases indicating an immediate safety concern show emergency guidance (the mission emergency channel; in Tunisia, 190 for medical emergencies and 197 for police).
- The relaxation screen includes generated landscapes, opt-in Web Audio ambience (off by default), guided breathing, 5-4-3-2-1 grounding and a break timer. It states that browsers cannot produce real scents.

## Accessibility & performance

Keyboard-navigable lists, a 2D map with focusable ships, focus-visible styles, labelled icon buttons, a dialog focus trap with Escape, `aria-live` for toasts and chat, and a skip link. The app respects `prefers-reduced-motion` with a manual override, and Arabic gets RTL layout mirroring via logical CSS properties (maps stay LTR, since they show spatial data). Secondary routes, Recharts and the 3D scene are code-split. The 3D view uses automatic low quality on mobile or low-core devices, disposes its geometry, and falls back to the 2D map when WebGL is unavailable or the context is lost.

## Known limitations

- Trajectories are illustrative arcs; the conflict model and fuel costs are simplified, explainable heuristics.
- Each browser keeps its own state; there is no multi-user or cross-device sync.
- Labels can overlap where many ships and stations cluster (e.g. near Earth); zoom in to separate them.
- There is no ESLint configuration (matching the sibling projects), so `lint` is not a script here.
# projet-lumynix
