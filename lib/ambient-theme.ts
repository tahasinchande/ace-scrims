export interface AmbientColorPhase {
  name: string
  /** Normalized 0..1 hue for Three.js HSL highlights */
  baseHue: number
  accentHue: number
  fillHue: number
  /** Primary RGB (0..255) for UI accents & primary glow */
  primaryRgb: [number, number, number]
  /** Soft luminous highlight RGB (0..255) for borders/rim highlights */
  softRgb: [number, number, number]
  /** Secondary/accent RGB (0..255) */
  accentRgb: [number, number, number]
  /** Deep atmospheric base RGB (0..255) for fog & shadow fills */
  deepRgb: [number, number, number]
  /** Controlled ambient wash RGB (0..255) */
  bgWashRgb: [number, number, number]
  /** Atmospheric horizon/radial bloom RGB (0..255) */
  glowRgb: [number, number, number]
  /** Normalized 0..1 RGB floats for WebGL / Three.js shaders */
  c1: [number, number, number]
  c2: [number, number, number]
  c3: [number, number, number]
  glow: [number, number, number]
  bgB: [number, number, number]
}

/** Deep obsidian night stage base (#030612) — crisp foreground readability */
export const STAGE_BASE_RGB: [number, number, number] = [3, 6, 18]
export const STAGE_BASE_NORM: [number, number, number] = [0.012, 0.024, 0.071]

/** Alias kept for backwards compatibility */
export const STAGE_BASE_2D_RGB: [number, number, number] = STAGE_BASE_RGB
export const STAGE_BASE_2D_NORM: [number, number, number] = STAGE_BASE_NORM

/**
 * Unified Color-Changing Spectrum (Identical across BOTH 2D & 3D modes):
 * - ALWAYS starts on Electric Blue / Cyan-Blue (Phase 0) on initial page load.
 * - Replaces all legacy orange/amber tones with blue-anchored cyber illumination.
 * - Smoothly cycles through Electric Blue -> Electric Cyan -> Cyber Violet -> Neon Orchid -> Luminous Azure -> Electric Blue
 *   while maintaining controlled obsidian contrast so text, lobby cards, and buttons stay sharp.
 */
export const AMBIENT_PHASES: AmbientColorPhase[] = [
  {
    // Phase 0 (INITIAL LOAD DEFAULT): Electric Blue / Cyan-Blue (#1F73FF / #38BDF8 / #BFF0FF)
    name: "electric-blue",
    baseHue: 217 / 360,
    accentHue: 199 / 360,
    fillHue: 226 / 360,
    primaryRgb: [31, 115, 255],
    accentRgb: [56, 189, 248],
    softRgb: [191, 240, 255],
    deepRgb: [5, 16, 46],
    glowRgb: [16, 68, 164],
    bgWashRgb: [7, 24, 68],
    c1: [0.122, 0.451, 1.0],
    c2: [0.22, 0.741, 0.973],
    c3: [0.749, 0.941, 1.0],
    glow: [0.063, 0.267, 0.643],
    bgB: [0.027, 0.094, 0.267],
  },
  {
    // Phase 1: Electric Cyan / Arctic Teal (#06B6D4 / #22D3EE / #CFFAFE)
    name: "electric-cyan",
    baseHue: 189 / 360,
    accentHue: 186 / 360,
    fillHue: 202 / 360,
    primaryRgb: [6, 182, 212],
    accentRgb: [34, 211, 238],
    softRgb: [207, 250, 254],
    deepRgb: [4, 22, 38],
    glowRgb: [12, 96, 134],
    bgWashRgb: [6, 36, 60],
    c1: [0.024, 0.714, 0.831],
    c2: [0.133, 0.827, 0.933],
    c3: [0.812, 0.98, 0.996],
    glow: [0.047, 0.376, 0.525],
    bgB: [0.024, 0.141, 0.235],
  },
  {
    // Phase 2: Cyber Indigo / Electric Violet (#6366F1 / #A78BFA / #E0E7FF)
    name: "cyber-violet",
    baseHue: 245 / 360,
    accentHue: 262 / 360,
    fillHue: 235 / 360,
    primaryRgb: [99, 102, 241],
    accentRgb: [167, 139, 250],
    softRgb: [224, 231, 255],
    deepRgb: [12, 10, 42],
    glowRgb: [56, 44, 152],
    bgWashRgb: [22, 18, 72],
    c1: [0.388, 0.4, 0.945],
    c2: [0.655, 0.545, 0.98],
    c3: [0.878, 0.906, 1.0],
    glow: [0.22, 0.173, 0.596],
    bgB: [0.086, 0.071, 0.282],
  },
  {
    // Phase 3: Neon Orchid / Deep Magenta (#B832E8 / #E879F9 / #FAE8FF)
    name: "neon-orchid",
    baseHue: 286 / 360,
    accentHue: 294 / 360,
    fillHue: 274 / 360,
    primaryRgb: [184, 50, 232],
    accentRgb: [232, 121, 249],
    softRgb: [250, 232, 255],
    deepRgb: [22, 8, 38],
    glowRgb: [96, 28, 132],
    bgWashRgb: [40, 14, 62],
    c1: [0.722, 0.196, 0.91],
    c2: [0.91, 0.475, 0.976],
    c3: [0.98, 0.91, 1.0],
    glow: [0.376, 0.11, 0.518],
    bgB: [0.157, 0.055, 0.243],
  },
  {
    // Phase 4: Luminous Azure / Hyper Sapphire (#0284C7 / #60A5FA / #DBEAFE)
    name: "luminous-azure",
    baseHue: 205 / 360,
    accentHue: 213 / 360,
    fillHue: 222 / 360,
    primaryRgb: [2, 132, 199],
    accentRgb: [96, 165, 250],
    softRgb: [219, 234, 254],
    deepRgb: [5, 18, 46],
    glowRgb: [14, 78, 148],
    bgWashRgb: [8, 28, 68],
    c1: [0.008, 0.518, 0.78],
    c2: [0.376, 0.647, 0.98],
    c3: [0.859, 0.918, 0.996],
    glow: [0.055, 0.306, 0.58],
    bgB: [0.031, 0.11, 0.267],
  },
]

export const AMBIENT_PHASES_3D = AMBIENT_PHASES
export const AMBIENT_PHASES_2D = AMBIENT_PHASES

/** Smooth continuous cadence: 1.6s blue settle + 3.6s Hermite glide (5.2s per phase, 26s full loop). */
export const PHASE_HOLD_SEC = 1.6
export const PHASE_TRANSITION_SEC = 3.6
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

function lerpVec3(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
}

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

/**
 * Returns the synchronized color-changing phase at `elapsedSec`.
 * Identical across BOTH "2d" and "3d" modes, always starting on Electric Blue at elapsedSec = 0.
 */
export function getAmbientPhaseAt(
  elapsedSec: number,
  _mode: "2d" | "3d" = "3d"
): InterpolatedAmbientState {
  const phases = AMBIENT_PHASES
  const safeElapsed = Math.max(0, elapsedSec)
  const count = phases.length
  const totalCycle = PHASE_TOTAL_SEC * count
  const cyclePos = safeElapsed % totalCycle
  const phaseIndex = Math.floor(cyclePos / PHASE_TOTAL_SEC) % count
  const withinPhase = cyclePos - phaseIndex * PHASE_TOTAL_SEC

  const current = phases[phaseIndex]
  const next = phases[(phaseIndex + 1) % count]

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

export function applyAmbientThemeToRoot(
  state: InterpolatedAmbientState,
  mode: "2d" | "3d" = "3d"
): void {
  if (typeof document === "undefined") return
  const root = document.documentElement
  const p = `${state.primaryRgb[0]}, ${state.primaryRgb[1]}, ${state.primaryRgb[2]}`
  const s = `${state.softRgb[0]}, ${state.softRgb[1]}, ${state.softRgb[2]}`
  const a = `${state.accentRgb[0]}, ${state.accentRgb[1]}, ${state.accentRgb[2]}`
  const d = `${state.deepRgb[0]}, ${state.deepRgb[1]}, ${state.deepRgb[2]}`
  const w = `${state.bgWashRgb[0]}, ${state.bgWashRgb[1]}, ${state.bgWashRgb[2]}`
  const g = `${state.glowRgb[0]}, ${state.glowRgb[1]}, ${state.glowRgb[2]}`

  root.dataset.viewMode = mode
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
