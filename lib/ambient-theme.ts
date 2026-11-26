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

/** 3D Cyber deep night sky base (#02050E) */
export const STAGE_BASE_RGB: [number, number, number] = [2, 5, 14]
export const STAGE_BASE_NORM: [number, number, number] = [0.008, 0.02, 0.055]

/** 2D Obsidian near-black base (#050508) — controlled low glare like randomqbit.site */
export const STAGE_BASE_2D_RGB: [number, number, number] = [5, 5, 8]
export const STAGE_BASE_2D_NORM: [number, number, number] = [0.02, 0.02, 0.031]

/**
 * 3D Cyber Cityscape Palette:
 * Deep night sky + bright cyan/ice-white horizon light band + atmospheric cyan-teal glow
 * spilling softly across the blocky cityscape silhouette and receding perspective grid.
 * Smooth 6s–12s breathing nuances while staying unmistakably true to the Cyber Horizon identity.
 */
export const AMBIENT_PHASES_3D: AmbientColorPhase[] = [
  {
    // Phase 0: Ice Cyan Horizon (#06B6D4 / #38BDF8 / #CFFAFE)
    name: "cyber-cyan-horizon",
    baseHue: 189 / 360,
    accentHue: 196 / 360,
    fillHue: 208 / 360,
    primaryRgb: [6, 182, 212],
    accentRgb: [56, 189, 248],
    softRgb: [207, 250, 254],
    deepRgb: [3, 10, 24],
    glowRgb: [14, 116, 144],
    bgWashRgb: [5, 24, 44],
    c1: [0.024, 0.714, 0.831],
    c2: [0.22, 0.741, 0.973],
    c3: [0.878, 0.984, 1.0],
    glow: [0.055, 0.455, 0.565],
    bgB: [0.02, 0.094, 0.173],
  },
  {
    // Phase 1: Arctic Teal Spill (#0891B2 / #22D3EE / #E0F9FF)
    name: "arctic-teal-spill",
    baseHue: 186 / 360,
    accentHue: 190 / 360,
    fillHue: 202 / 360,
    primaryRgb: [8, 145, 178],
    accentRgb: [34, 211, 238],
    softRgb: [224, 249, 255],
    deepRgb: [2, 12, 22],
    glowRgb: [13, 132, 152],
    bgWashRgb: [4, 28, 42],
    c1: [0.031, 0.569, 0.698],
    c2: [0.133, 0.827, 0.933],
    c3: [0.878, 0.976, 1.0],
    glow: [0.051, 0.518, 0.596],
    bgB: [0.016, 0.11, 0.165],
  },
  {
    // Phase 2: Midnight Azure Skyline (#0284C7 / #67E8F9 / #E0F2FE)
    name: "midnight-azure-skyline",
    baseHue: 199 / 360,
    accentHue: 187 / 360,
    fillHue: 215 / 360,
    primaryRgb: [2, 132, 199],
    accentRgb: [103, 232, 249],
    softRgb: [224, 242, 254],
    deepRgb: [4, 11, 28],
    glowRgb: [14, 102, 156],
    bgWashRgb: [6, 22, 48],
    c1: [0.008, 0.518, 0.78],
    c2: [0.404, 0.91, 0.976],
    c3: [0.878, 0.949, 0.996],
    glow: [0.055, 0.4, 0.612],
    bgB: [0.024, 0.086, 0.188],
  },
]

/**
 * 2D Ambient Mode Palette (randomqbit.site direction):
 * Deep obsidian / near-black base (#050508 -> #09070F) with controlled, non-glaring
 * radial violet/purple glow (#6B2FA8 -> #3E1A6E -> #050508) and crisp violet accents
 * (#8C44D4 / #9B5DE5) so foreground text, lobby times, and cards stay razor-sharp.
 */
export const AMBIENT_PHASES_2D: AmbientColorPhase[] = [
  {
    // Phase 0: Controlled Obsidian Violet (#8C44D4 / #9B5DE5 / #DDD6FE)
    name: "obsidian-violet",
    baseHue: 270 / 360,
    accentHue: 266 / 360,
    fillHue: 275 / 360,
    primaryRgb: [140, 68, 212], // #8C44D4
    accentRgb: [155, 93, 229], // #9B5DE5
    softRgb: [216, 196, 248],
    deepRgb: [9, 7, 15], // #09070F
    glowRgb: [107, 47, 168], // #6B2FA8
    bgWashRgb: [62, 26, 110], // #3E1A6E
    c1: [0.42, 0.184, 0.659], // #6B2FA8 controlled core
    c2: [0.549, 0.267, 0.831], // #8C44D4 subtle highlight
    c3: [0.608, 0.365, 0.898], // #9B5DE5 soft rim
    glow: [0.42, 0.184, 0.659], // #6B2FA8
    bgB: [0.243, 0.102, 0.431], // #3E1A6E
  },
  {
    // Phase 1: Deep Amethyst Dusk (#7E3AF2 / #A76BF0 / #E5DCFA)
    name: "deep-amethyst-dusk",
    baseHue: 264 / 360,
    accentHue: 272 / 360,
    fillHue: 258 / 360,
    primaryRgb: [132, 66, 218],
    accentRgb: [162, 102, 236],
    softRgb: [222, 204, 250],
    deepRgb: [8, 6, 14],
    glowRgb: [96, 42, 158],
    bgWashRgb: [54, 24, 100],
    c1: [0.376, 0.165, 0.62],
    c2: [0.518, 0.259, 0.855],
    c3: [0.635, 0.4, 0.925],
    glow: [0.376, 0.165, 0.62],
    bgB: [0.212, 0.094, 0.392],
  },
  {
    // Phase 2: Velvet Indigo Obsidian (#9B5DE5 / #8C44D4 / #DDD6FE)
    name: "velvet-indigo-obsidian",
    baseHue: 274 / 360,
    accentHue: 268 / 360,
    fillHue: 280 / 360,
    primaryRgb: [148, 76, 222],
    accentRgb: [155, 93, 229],
    softRgb: [218, 198, 248],
    deepRgb: [9, 7, 15],
    glowRgb: [112, 48, 174],
    bgWashRgb: [66, 26, 114],
    c1: [0.439, 0.188, 0.682],
    c2: [0.58, 0.298, 0.871],
    c3: [0.608, 0.365, 0.898],
    glow: [0.439, 0.188, 0.682],
    bgB: [0.259, 0.102, 0.447],
  },
]

/** Backwards-compatible default export referencing 3D phases */
export const AMBIENT_PHASES: AmbientColorPhase[] = AMBIENT_PHASES_3D

/** Calm 6s–12s breathing loop cadence (3.5s settle + 4.5s smooth glide = 8s per phase) */
export const PHASE_HOLD_SEC = 2.0
export const PHASE_TRANSITION_SEC = 6.0
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

export function getAmbientPhaseAt(
  elapsedSec: number,
  mode: "2d" | "3d" = "3d"
): InterpolatedAmbientState {
  const phases = mode === "2d" ? AMBIENT_PHASES_2D : AMBIENT_PHASES_3D
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
