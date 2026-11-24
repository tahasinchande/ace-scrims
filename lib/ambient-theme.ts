export interface AmbientColorPhase {
  name: string
  /** Normalized 0..1 hue for Three.js */
  baseHue: number
  accentHue: number
  fillHue: number
  /** Primary RGB triplet for CSS variables & UI accents */
  primaryRgb: [number, number, number]
  /** Soft highlight RGB triplet for borders/rings */
  softRgb: [number, number, number]
  /** Secondary/accent RGB triplet for highlights & icons */
  accentRgb: [number, number, number]
  /** Deep atmospheric stage RGB triplet */
  deepRgb: [number, number, number]
  /** Top-left diagonal ambient wash RGB (RandomQbit FS_BG `bgB`) */
  bgWashRgb: [number, number, number]
  /** Upper-right & upper-center radiant bloom RGB (RandomQbit FS_BG `uGlow`) */
  glowRgb: [number, number, number]
}

/**
 * RandomQbit-inspired continuous hold + smoothstep color cycle.
 * Phase 0 preserves RushX Organization's unmistakable primary entrance color (Electric Cobalt Blue),
 * then shifts smoothly through Teal -> Solar Gold -> Neon Rose/Pink -> Electric Violet -> Cobalt Blue.
 */
export const AMBIENT_PHASES: AmbientColorPhase[] = [
  {
    // Phase 0 (Primary Entrance): Electric Cobalt Blue + Sky Cyan
    name: "cobalt-blue",
    baseHue: 217 / 360,
    accentHue: 196 / 360,
    fillHue: 232 / 360,
    primaryRgb: [37, 99, 235],
    softRgb: [125, 190, 255],
    accentRgb: [56, 189, 248],
    deepRgb: [10, 26, 76],
    bgWashRgb: [12, 34, 98],
    glowRgb: [28, 92, 224],
  },
  {
    // Phase 1: Quantum Teal / Emerald Cyan
    name: "quantum-teal",
    baseHue: 170 / 360,
    accentHue: 156 / 360,
    fillHue: 192 / 360,
    primaryRgb: [20, 184, 166],
    softRgb: [110, 240, 220],
    accentRgb: [51, 235, 184],
    deepRgb: [7, 40, 52],
    bgWashRgb: [9, 52, 66],
    glowRgb: [18, 160, 146],
  },
  {
    // Phase 2: Solar Gold / Amber Glow
    name: "solar-gold",
    baseHue: 36 / 360,
    accentHue: 45 / 360,
    fillHue: 22 / 360,
    primaryRgb: [234, 142, 20],
    softRgb: [253, 214, 102],
    accentRgb: [255, 179, 71],
    deepRgb: [46, 28, 16],
    bgWashRgb: [58, 34, 24],
    glowRgb: [198, 104, 24],
  },
  {
    // Phase 3: Neon Rose / Magenta Pink
    name: "neon-rose",
    baseHue: 328 / 360,
    accentHue: 310 / 360,
    fillHue: 290 / 360,
    primaryRgb: [225, 64, 148],
    softRgb: [250, 168, 214],
    accentRgb: [255, 97, 184],
    deepRgb: [50, 16, 56],
    bgWashRgb: [66, 20, 74],
    glowRgb: [196, 42, 138],
  },
  {
    // Phase 4: Electric Violet / Royal Indigo
    name: "electric-violet",
    baseHue: 258 / 360,
    accentHue: 242 / 360,
    fillHue: 278 / 360,
    primaryRgb: [129, 86, 246],
    softRgb: [196, 178, 255],
    accentRgb: [161, 115, 255],
    deepRgb: [28, 22, 78],
    bgWashRgb: [38, 28, 98],
    glowRgb: [118, 62, 224],
  },
]

/** Exact RandomQbit hold & fade cadence: hold 2.2s, smoothstep fade 3.0s (5.2s per phase, 26s full loop). */
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
