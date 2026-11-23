export interface AmbientColorPhase {
  name: string
  /** Normalized 0..1 hue for Three.js */
  baseHue: number
  accentHue: number
  fillHue: number
  /** Primary RGB triplet for CSS variables */
  primaryRgb: [number, number, number]
  /** Soft highlight RGB triplet */
  softRgb: [number, number, number]
  /** Secondary/accent RGB triplet */
  accentRgb: [number, number, number]
  /** Deep atmospheric wash RGB triplet */
  deepRgb: [number, number, number]
}

/**
 * Curated RandomQbit-inspired delay-driven color phases.
 * Phase 0 is Electric Cobalt Blue — the unmistakable primary entrance color of RushX Organization.
 */
export const AMBIENT_PHASES: AmbientColorPhase[] = [
  {
    // Phase 0 (Primary Entrance): Electric Cobalt Blue + Sky Cyan
    name: "cobalt-blue",
    baseHue: 217 / 360,
    accentHue: 196 / 360,
    fillHue: 232 / 360,
    primaryRgb: [37, 99, 235],
    softRgb: [96, 165, 250],
    accentRgb: [56, 189, 248],
    deepRgb: [12, 34, 88],
  },
  {
    // Phase 1: Ocean Cyan + Teal Glow
    name: "ocean-cyan",
    baseHue: 194 / 360,
    accentHue: 172 / 360,
    fillHue: 212 / 360,
    primaryRgb: [14, 165, 233],
    softRgb: [56, 189, 248],
    accentRgb: [45, 212, 191],
    deepRgb: [8, 44, 72],
  },
  {
    // Phase 2: Deep Royal Azure + Electric Indigo-Blue
    name: "royal-azure",
    baseHue: 229 / 360,
    accentHue: 204 / 360,
    fillHue: 245 / 360,
    primaryRgb: [59, 114, 246],
    softRgb: [125, 168, 255],
    accentRgb: [56, 189, 248],
    deepRgb: [18, 30, 86],
  },
  {
    // Phase 3: Cyber Emerald-Aqua + Ice Blue
    name: "cyber-aqua",
    baseHue: 168 / 360,
    accentHue: 196 / 360,
    fillHue: 184 / 360,
    primaryRgb: [16, 185, 129],
    softRgb: [52, 211, 153],
    accentRgb: [56, 189, 248],
    deepRgb: [8, 52, 48],
  },
  {
    // Phase 4: Luminous Sapphire + Cerulean
    name: "luminous-sapphire",
    baseHue: 208 / 360,
    accentHue: 188 / 360,
    fillHue: 224 / 360,
    primaryRgb: [2, 132, 199],
    softRgb: [96, 165, 250],
    accentRgb: [34, 211, 238],
    deepRgb: [10, 38, 78],
  },
]

/** Hold calmly on each color for 5.5s, then smoothly transition over 2.2s (7.7s per phase). */
export const PHASE_HOLD_SEC = 5.5
export const PHASE_TRANSITION_SEC = 2.2
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
  t: number
): [number, number, number] {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ]
}

/** Smooth cosine/cubic ease-in-out curve for calm, natural color transitions */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export interface InterpolatedAmbientState {
  baseHue: number
  accentHue: number
  fillHue: number
  primaryRgb: [number, number, number]
  softRgb: [number, number, number]
  accentRgb: [number, number, number]
  deepRgb: [number, number, number]
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
      isTransitioning: false,
      phaseIndex,
    }
  }

  const rawT = Math.min(1, (withinPhase - PHASE_HOLD_SEC) / PHASE_TRANSITION_SEC)
  const t = easeInOutCubic(rawT)

  return {
    baseHue: lerpHue(current.baseHue, next.baseHue, t),
    accentHue: lerpHue(current.accentHue, next.accentHue, t),
    fillHue: lerpHue(current.fillHue, next.fillHue, t),
    primaryRgb: lerpRgb(current.primaryRgb, next.primaryRgb, t),
    softRgb: lerpRgb(current.softRgb, next.softRgb, t),
    accentRgb: lerpRgb(current.accentRgb, next.accentRgb, t),
    deepRgb: lerpRgb(current.deepRgb, next.deepRgb, t),
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

  root.style.setProperty("--rushx-primary-rgb", p)
  root.style.setProperty("--rushx-soft-rgb", s)
  root.style.setProperty("--rushx-accent-rgb", a)
  root.style.setProperty("--rushx-deep-rgb", d)
  root.style.setProperty("--primary", `rgb(${p})`)
  root.style.setProperty("--accent", `rgb(${a})`)
  root.style.setProperty("--ring", `rgb(${s})`)
  root.style.setProperty("--sidebar-primary", `rgb(${p})`)
  root.style.setProperty("--sidebar-ring", `rgb(${s})`)
}
