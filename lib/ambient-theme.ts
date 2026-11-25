export interface AmbientColorPhase {
  name: string
  /** Normalized 0..1 hue for Three.js HSL highlights */
  baseHue: number
  accentHue: number
  fillHue: number
  /** Verified RandomQbit orb.js c1 -> Primary RGB (0..255) for UI accents & 3D key/core */
  primaryRgb: [number, number, number]
  /** Verified RandomQbit orb.js c3 -> Soft luminous highlight RGB (0..255) for borders/laser cores */
  softRgb: [number, number, number]
  /** Verified RandomQbit qbit.css / orb.js c2 -> Secondary/accent RGB (0..255) */
  accentRgb: [number, number, number]
  /** Derived deep atmospheric base RGB (0..255) for fog & shadow fills */
  deepRgb: [number, number, number]
  /** Verified RandomQbit orb.js bgB -> Top-left diagonal ambient wash RGB (0..255) */
  bgWashRgb: [number, number, number]
  /** Verified RandomQbit orb.js glow -> Upper-right & upper-center radiant bloom RGB (0..255) */
  glowRgb: [number, number, number]
  /** Normalized 0..1 RGB floats for WebGL / Three.js shaders */
  c1: [number, number, number]
  c2: [number, number, number]
  c3: [number, number, number]
  glow: [number, number, number]
  bgB: [number, number, number]
}

/** Verified RandomQbit stage base (#020308) from qbit.css `--qb-stage` & orb.js `bgA` */
export const STAGE_BASE_RGB: [number, number, number] = [2, 3, 8]
export const STAGE_BASE_NORM: [number, number, number] = [0.008, 0.012, 0.031]

/**
 * Verified RandomQbit continuous hold + smoothstep color cycle
 * (extracted directly from https://randomqbit.site/wp-content/themes/qbit/assets/js/orb.js & qbit.css),
 * anchored at Phase 0 Electric Blue to preserve RushX Organization's unmistakable entrance color.
 */
export const AMBIENT_PHASES: AmbientColorPhase[] = [
  {
    // Phase 0 (Primary Entrance): Electric Blue (#1F73FF / #40B8FF / #BFF0FF / #0A2661 / #050F33)
    name: "electric-blue",
    baseHue: 217 / 360,
    accentHue: 202 / 360,
    fillHue: 226 / 360,
    primaryRgb: [31, 115, 255],
    accentRgb: [64, 184, 255],
    softRgb: [191, 240, 255],
    deepRgb: [7, 22, 64],
    glowRgb: [10, 38, 97],
    bgWashRgb: [5, 15, 51],
    c1: [0.12, 0.45, 1.0],
    c2: [0.25, 0.72, 1.0],
    c3: [0.75, 0.94, 1.0],
    glow: [0.04, 0.15, 0.38],
    bgB: [0.02, 0.06, 0.2],
  },
  {
    // Phase 1: Quantum Teal (#1A9ED9 / #33EBB8 / #C7FFE0 / #083D38 / #04141F)
    name: "quantum-teal",
    baseHue: 175 / 360,
    accentHue: 163 / 360,
    fillHue: 198 / 360,
    primaryRgb: [26, 158, 217],
    accentRgb: [51, 235, 184],
    softRgb: [199, 255, 224],
    deepRgb: [6, 32, 42],
    glowRgb: [8, 61, 56],
    bgWashRgb: [4, 20, 31],
    c1: [0.1, 0.62, 0.85],
    c2: [0.2, 0.92, 0.72],
    c3: [0.78, 1.0, 0.88],
    glow: [0.03, 0.24, 0.22],
    bgB: [0.015, 0.08, 0.12],
  },
  {
    // Phase 2: Solar Gold (#F2662E / #FFB347 / #FFEBA8 / #422108 / #0F0B1F)
    name: "solar-gold",
    baseHue: 34 / 360,
    accentHue: 40 / 360,
    fillHue: 22 / 360,
    primaryRgb: [242, 102, 46],
    accentRgb: [255, 179, 71],
    softRgb: [255, 235, 168],
    deepRgb: [36, 20, 14],
    glowRgb: [66, 33, 8],
    bgWashRgb: [15, 11, 31],
    c1: [0.95, 0.4, 0.18],
    c2: [1.0, 0.7, 0.28],
    c3: [1.0, 0.92, 0.66],
    glow: [0.26, 0.13, 0.03],
    bgB: [0.06, 0.045, 0.12],
  },
  {
    // Phase 3: Neon Rose / Magenta Pink (#B338FF / #FF61B8 / #FFC7EB / #520D42 / #12082B)
    name: "neon-rose",
    baseHue: 325 / 360,
    accentHue: 304 / 360,
    fillHue: 280 / 360,
    primaryRgb: [179, 56, 255],
    accentRgb: [255, 97, 184],
    softRgb: [255, 199, 235],
    deepRgb: [38, 12, 48],
    glowRgb: [82, 13, 66],
    bgWashRgb: [18, 8, 43],
    c1: [0.7, 0.22, 1.0],
    c2: [1.0, 0.38, 0.72],
    c3: [1.0, 0.78, 0.92],
    glow: [0.32, 0.05, 0.26],
    bgB: [0.07, 0.03, 0.17],
  },
  {
    // Phase 4: Electric Violet (#5266FF / #A173FF / #EDB8FF / #361766 / #0B0F36)
    name: "electric-violet",
    baseHue: 256 / 360,
    accentHue: 242 / 360,
    fillHue: 274 / 360,
    primaryRgb: [82, 102, 255],
    accentRgb: [161, 115, 255],
    softRgb: [237, 184, 255],
    deepRgb: [22, 18, 66],
    glowRgb: [54, 23, 102],
    bgWashRgb: [11, 15, 54],
    c1: [0.32, 0.4, 1.0],
    c2: [0.63, 0.45, 1.0],
    c3: [0.93, 0.72, 1.0],
    glow: [0.21, 0.09, 0.4],
    bgB: [0.045, 0.06, 0.21],
  },
]

/** Verified RandomQbit orb.js cadence: hold 2.2s, smoothstep fade 3.0s (5.2s per phase, 26.0s full cycle). */
export const PHASE_HOLD_SEC = 2.2
export const PHASE_TRANSITION_SEC = 3.0
export const PHASE_TOTAL_SEC = PHASE_HOLD_SEC + PHASE_TRANSITION_SEC

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpHue(a: number, b: number, t: number): number {
  let diff = b - a
  if (diff > 0.5) diff -= 1
  if (diff < -0.5) diff += 1
  return (a + diff * t + 1) % 1
}

function lerpRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ]
}

function lerpVec3(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
}

/** Hermite smoothstep curve matching RandomQbit's `m * m * (3 - 2 * m)` fade */
function smoothstep(t: number): number {
  const clamped = Math.max(0, Math.min(1, t))
  return clamped * clamped * (3 - 2 * clamped)
}

export interface InterpolatedAmbientState {
  baseHue: number
  accentHue: number
  fillHue: number
  primaryRgb: [number, number, number]
  softRgb: [number, number, number]
  accentRgb: [number, number, number]
  deepRgb: [number, number, number]
  bgWashRgb: [number, number, number]
  glowRgb: [number, number, number]
  c1: [number, number, number]
  c2: [number, number, number]
  c3: [number, number, number]
  glow: [number, number, number]
  bgB: [number, number, number]
  isTransitioning: boolean
  phaseIndex: number
}

export function getAmbientPhaseAt(elapsedSec: number): InterpolatedAmbientState {
  const safeElapsed = Math.max(0, elapsedSec)
  const count = AMBIENT_PHASES.length
  const totalCycle = PHASE_TOTAL_SEC * count
  const cyclePos = safeElapsed % totalCycle
  const phaseIndex = Math.floor(cyclePos / PHASE_TOTAL_SEC) % count
  const withinPhase = cyclePos - phaseIndex * PHASE_TOTAL_SEC

  const current = AMBIENT_PHASES[phaseIndex]
  const next = AMBIENT_PHASES[(phaseIndex + 1) % count]

  if (withinPhase <= PHASE_HOLD_SEC) {
    return {
      baseHue: current.baseHue,
      accentHue: current.accentHue,
      fillHue: current.fillHue,
      primaryRgb: current.primaryRgb,
      softRgb: current.softRgb,
      accentRgb: current.accentRgb,
      deepRgb: current.deepRgb,
      bgWashRgb: current.bgWashRgb,
      glowRgb: current.glowRgb,
      c1: current.c1,
      c2: current.c2,
      c3: current.c3,
      glow: current.glow,
      bgB: current.bgB,
      isTransitioning: false,
      phaseIndex,
    }
  }

  const rawT = Math.min(1, (withinPhase - PHASE_HOLD_SEC) / PHASE_TRANSITION_SEC)
  const t = smoothstep(rawT)

  return {
    baseHue: lerpHue(current.baseHue, next.baseHue, t),
    accentHue: lerpHue(current.accentHue, next.accentHue, t),
    fillHue: lerpHue(current.fillHue, next.fillHue, t),
    primaryRgb: lerpRgb(current.primaryRgb, next.primaryRgb, t),
    softRgb: lerpRgb(current.softRgb, next.softRgb, t),
    accentRgb: lerpRgb(current.accentRgb, next.accentRgb, t),
    deepRgb: lerpRgb(current.deepRgb, next.deepRgb, t),
    bgWashRgb: lerpRgb(current.bgWashRgb, next.bgWashRgb, t),
    glowRgb: lerpRgb(current.glowRgb, next.glowRgb, t),
    c1: lerpVec3(current.c1, next.c1, t),
    c2: lerpVec3(current.c2, next.c2, t),
    c3: lerpVec3(current.c3, next.c3, t),
    glow: lerpVec3(current.glow, next.glow, t),
    bgB: lerpVec3(current.bgB, next.bgB, t),
    isTransitioning: true,
    phaseIndex,
  }
}

export function applyAmbientThemeToRoot(state: InterpolatedAmbientState): void {
  if (typeof document === "undefined") return
  const root = document.documentElement
  const p = `${state.primaryRgb[0]}, ${state.primaryRgb[1]}, ${state.primaryRgb[2]}`
  const s = `${state.softRgb[0]}, ${state.softRgb[1]}, ${state.softRgb[2]}`
  const a = `${state.accentRgb[0]}, ${state.accentRgb[1]}, ${state.accentRgb[2]}`
  const d = `${state.deepRgb[0]}, ${state.deepRgb[1]}, ${state.deepRgb[2]}`
  const w = `${state.bgWashRgb[0]}, ${state.bgWashRgb[1]}, ${state.bgWashRgb[2]}`
  const g = `${state.glowRgb[0]}, ${state.glowRgb[1]}, ${state.glowRgb[2]}`

  root.style.setProperty("--rushx-primary-rgb", p)
  root.style.setProperty("--rushx-soft-rgb", s)
  root.style.setProperty("--rushx-accent-rgb", a)
  root.style.setProperty("--rushx-deep-rgb", d)
  root.style.setProperty("--rushx-bg-wash-rgb", w)
  root.style.setProperty("--rushx-glow-rgb", g)
  root.style.setProperty("--primary", `rgb(${p})`)
  root.style.setProperty("--accent", `rgb(${a})`)
  root.style.setProperty("--ring", `rgb(${s})`)
  root.style.setProperty("--sidebar-primary", `rgb(${p})`)
  root.style.setProperty("--sidebar-ring", `rgb(${s})`)
}
