import {
  buildAmbientPhaseFromHex,
  type BackgroundThemeConfig,
} from "@/lib/background-config"

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

/** Deep obsidian night stage base (#040712) — crisp foreground readability */
export const STAGE_BASE_RGB: [number, number, number] = [4, 7, 18]
export const STAGE_BASE_NORM: [number, number, number] = [0.016, 0.027, 0.071]

/** Alias kept for backwards compatibility */
export const STAGE_BASE_2D_RGB: [number, number, number] = STAGE_BASE_RGB
export const STAGE_BASE_2D_NORM: [number, number, number] = STAGE_BASE_NORM

/**
 * Unified Dynamic Color-Changing Spectrum (Identical across BOTH 2D Ambient & 3D Cyber modes):
 * - Phase 0 (INITIAL OPENING COLOR for BOTH 2D & 3D): Electric Blue (#1F73FF / #38BDF8 / #BFF0FF).
 * - Smoothly glides into Cyber Violet, then the signature 88918cc Cyber Orange (#F97316 / #FF6A00 / #FBBF24),
 *   followed by Neon Orchid and Electric Cyan before looping cleanly back to Electric Blue.
 * - Maintains controlled obsidian contrast across every phase so headings, cards, and buttons stay sharp.
 */
export const AMBIENT_PHASES: AmbientColorPhase[] = [
  {
    // Phase 0 (INITIAL LOAD DEFAULT — BLUE): Electric Blue / Ice Cyan (#1F73FF / #38BDF8 / #BFF0FF)
    name: "electric-blue",
    baseHue: 217 / 360,
    accentHue: 199 / 360,
    fillHue: 226 / 360,
    primaryRgb: [31, 115, 255],
    accentRgb: [56, 189, 248],
    softRgb: [191, 240, 255],
    deepRgb: [5, 16, 46],
    glowRgb: [18, 72, 174],
    bgWashRgb: [8, 26, 74],
    c1: [0.122, 0.451, 1.0],
    c2: [0.22, 0.741, 0.973],
    c3: [0.749, 0.941, 1.0],
    glow: [0.071, 0.282, 0.682],
    bgB: [0.031, 0.102, 0.29],
  },
  {
    // Phase 1 (Nov 23 Signature): Cyber Violet / Deep Purple (#8C44D4 / #A78BFA / #E9D5FF)
    name: "cyber-violet",
    baseHue: 268 / 360,
    accentHue: 255 / 360,
    fillHue: 274 / 360,
    primaryRgb: [140, 68, 212],
    accentRgb: [167, 139, 250],
    softRgb: [233, 213, 255],
    deepRgb: [16, 8, 40],
    glowRgb: [92, 42, 166],
    bgWashRgb: [30, 14, 68],
    c1: [0.549, 0.267, 0.831],
    c2: [0.655, 0.545, 0.98],
    c3: [0.914, 0.835, 1.0],
    glow: [0.361, 0.165, 0.651],
    bgB: [0.118, 0.055, 0.267],
  },
  {
    // Phase 2 (88918cc Signature): Cyber Orange / Molten Amber (#F97316 / #FBBF24 / #FFF0AA)
    name: "cyber-orange",
    baseHue: 24 / 360,
    accentHue: 36 / 360,
    fillHue: 14 / 360,
    primaryRgb: [249, 115, 22],
    accentRgb: [251, 191, 36],
    softRgb: [255, 237, 213],
    deepRgb: [42, 14, 4],
    glowRgb: [194, 65, 12],
    bgWashRgb: [68, 22, 6],
    c1: [0.976, 0.451, 0.086],
    c2: [0.984, 0.749, 0.141],
    c3: [1.0, 0.941, 0.667],
    glow: [0.761, 0.255, 0.047],
    bgB: [0.267, 0.086, 0.024],
  },
  {
    // Phase 3: Neon Orchid / Amethyst Magenta (#C038E8 / #E879F9 / #FAE8FF)
    name: "neon-orchid",
    baseHue: 294 / 360,
    accentHue: 304 / 360,
    fillHue: 278 / 360,
    primaryRgb: [192, 56, 232],
    accentRgb: [232, 121, 249],
    softRgb: [250, 232, 255],
    deepRgb: [22, 8, 38],
    glowRgb: [112, 32, 152],
    bgWashRgb: [40, 14, 64],
    c1: [0.753, 0.22, 0.91],
    c2: [0.91, 0.475, 0.976],
    c3: [0.98, 0.91, 1.0],
    glow: [0.439, 0.125, 0.596],
    bgB: [0.157, 0.055, 0.251],
  },
  {
    // Phase 4: Electric Cyan / Arctic Horizon (#06B6D4 / #22D3EE / #CFFAFE)
    name: "electric-cyan",
    baseHue: 189 / 360,
    accentHue: 186 / 360,
    fillHue: 202 / 360,
    primaryRgb: [6, 182, 212],
    accentRgb: [34, 211, 238],
    softRgb: [207, 250, 254],
    deepRgb: [4, 22, 38],
    glowRgb: [14, 102, 142],
    bgWashRgb: [6, 36, 62],
    c1: [0.024, 0.714, 0.831],
    c2: [0.133, 0.827, 0.933],
    c3: [0.812, 0.98, 0.996],
    glow: [0.055, 0.4, 0.557],
    bgB: [0.024, 0.141, 0.243],
  },
]

export const AMBIENT_PHASES_3D = AMBIENT_PHASES
export const AMBIENT_PHASES_2D = AMBIENT_PHASES

/** Smooth continuous cadence: 2.2s Blue initial hold + 4.2s smoothstep glide (6.4s per phase, 32s full cycle). */
export const PHASE_HOLD_SEC = 2.2
export const PHASE_TRANSITION_SEC = 4.2
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

export function resolveAmbientPhases(
  config?: BackgroundThemeConfig | null
): AmbientColorPhase[] {
  if (!config) return AMBIENT_PHASES

  const enabledSet = new Set(config.enabledBuiltInPhases || [])
  const resolvedWithIds: Array<{ id: string; phase: AmbientColorPhase }> = []

  for (const phase of AMBIENT_PHASES) {
    if (enabledSet.has(phase.name as any)) {
      resolvedWithIds.push({ id: phase.name, phase })
    }
  }

  if (Array.isArray(config.customColors)) {
    for (const c of config.customColors) {
      if (c && c.hex) {
        const id = c.id || c.name || c.hex
        resolvedWithIds.push({
          id,
          phase: buildAmbientPhaseFromHex(c.name || c.id || c.hex, c.hex),
        })
      }
    }
  }

  if (resolvedWithIds.length === 0) {
    return [AMBIENT_PHASES[0]]
  }

  const desiredId = (config.initialPrimaryColorId || "").trim()
  if (desiredId) {
    const startIdx = resolvedWithIds.findIndex(
      (entry) => entry.id === desiredId || entry.phase.name === desiredId
    )
    if (startIdx > 0) {
      const rotated = [
        ...resolvedWithIds.slice(startIdx),
        ...resolvedWithIds.slice(0, startIdx),
      ]
      return rotated.map((entry) => entry.phase)
    }
  }

  return resolvedWithIds.map((entry) => entry.phase)
}

/**
 * Returns the synchronized color-changing phase at `elapsedSec`.
 * Identical across BOTH "2d" and "3d" modes, always opening on the first configured phase (Electric Blue by default) at elapsedSec = 0.
 */
export function getAmbientPhaseAt(
  elapsedSec: number,
  _mode: "2d" | "3d" = "3d",
  config?: BackgroundThemeConfig | null
): InterpolatedAmbientState {
  const phases = resolveAmbientPhases(config)
  const holdSec =
    config && Number.isFinite(config.delaySeconds) && config.delaySeconds >= 0.5
      ? config.delaySeconds
      : PHASE_HOLD_SEC
  const transitionSec =
    config && Number.isFinite(config.transitionSeconds) && config.transitionSeconds >= 0.5
      ? config.transitionSeconds
      : PHASE_TRANSITION_SEC
  const phaseTotalSec = holdSec + transitionSec

  const safeElapsed = Math.max(0, elapsedSec)
  const count = phases.length

  if (count === 1) {
    const only = phases[0]
    return {
      baseHue: only.baseHue,
      accentHue: only.accentHue,
      fillHue: only.fillHue,
      primaryRgb: only.primaryRgb,
      softRgb: only.softRgb,
      accentRgb: only.accentRgb,
      deepRgb: only.deepRgb,
      bgWashRgb: only.bgWashRgb,
      glowRgb: only.glowRgb,
      c1: only.c1,
      c2: only.c2,
      c3: only.c3,
      glow: only.glow,
      bgB: only.bgB,
      isTransitioning: false,
      phaseIndex: 0,
    }
  }

  const totalCycle = phaseTotalSec * count
  const cyclePos = safeElapsed % totalCycle
  const phaseIndex = Math.floor(cyclePos / phaseTotalSec) % count
  const withinPhase = cyclePos - phaseIndex * phaseTotalSec

  const current = phases[phaseIndex]
  const next = phases[(phaseIndex + 1) % count]

  if (withinPhase <= holdSec) {
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

  const rawT = Math.min(1, (withinPhase - holdSec) / transitionSec)
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
