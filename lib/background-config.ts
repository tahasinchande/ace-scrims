import { z } from "zod"

export const BUILT_IN_PHASE_IDS = [
  "electric-blue",
  "cyber-violet",
  "cyber-orange",
  "neon-orchid",
  "electric-cyan",
] as const

export type BuiltInPhaseId = (typeof BUILT_IN_PHASE_IDS)[number]

export interface CustomPaletteColor {
  id: string
  name: string
  hex: string
}

export interface BackgroundThemeConfig {
  /** Hold duration in seconds before gliding to the next color (0.5 - 60) */
  delaySeconds: number
  /** Smooth transition glide duration in seconds between colors (0.5 - 20) */
  transitionSeconds: number
  /** Active built-in spectrum phases */
  enabledBuiltInPhases: BuiltInPhaseId[]
  /** Admin-added extra colors appended to the live background rotation */
  customColors: CustomPaletteColor[]
  /** ID of the primary built-in phase or custom color displayed first when the site loads */
  initialPrimaryColorId?: string
  updatedAt?: string
}

export const DEFAULT_BACKGROUND_THEME_CONFIG: BackgroundThemeConfig = {
  delaySeconds: 2.2,
  transitionSeconds: 4.2,
  enabledBuiltInPhases: [...BUILT_IN_PHASE_IDS],
  customColors: [],
  initialPrimaryColorId: "electric-blue",
}

export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

export function normalizeHexColor(raw: string | null | undefined): string {
  const trimmed = (raw || "").trim()
  if (!trimmed) return ""
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`
  if (/^#[0-9a-fA-F]{3}$/.test(withHash)) {
    const [, r, g, b] = withHash
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }
  if (HEX_COLOR_RE.test(withHash)) {
    return withHash.toUpperCase()
  }
  return ""
}

export const customPaletteColorSchema = z.object({
  id: z.string().trim().min(1).max(48),
  name: z.string().trim().min(1, "Color name is required").max(32, "Color name too long"),
  hex: z
    .string()
    .trim()
    .transform((v) => normalizeHexColor(v))
    .refine((v) => HEX_COLOR_RE.test(v), "Invalid hex color (use #RRGGBB)"),
})

export const backgroundThemeConfigSchema = z
  .object({
    delaySeconds: z.coerce.number().min(0.5, "Delay must be at least 0.5s").max(60, "Delay cannot exceed 60s"),
    transitionSeconds: z.coerce
      .number()
      .min(0.5, "Transition must be at least 0.5s")
      .max(20, "Transition cannot exceed 20s"),
    enabledBuiltInPhases: z.array(z.enum(BUILT_IN_PHASE_IDS)).default([...BUILT_IN_PHASE_IDS]),
    customColors: z.array(customPaletteColorSchema).max(16, "Maximum 16 custom colors allowed").default([]),
    initialPrimaryColorId: z.string().trim().max(48).optional(),
    updatedAt: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.enabledBuiltInPhases.length === 0 && data.customColors.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["enabledBuiltInPhases"],
        message: "Select at least one built-in or custom color for the background palette.",
      })
    }
  })

export function parseBackgroundThemeConfig(rawJson: string | null | undefined): BackgroundThemeConfig {
  if (!rawJson || !rawJson.trim()) {
    return {
      ...DEFAULT_BACKGROUND_THEME_CONFIG,
      enabledBuiltInPhases: [...BUILT_IN_PHASE_IDS],
      customColors: [],
    }
  }
  try {
    const parsed = JSON.parse(rawJson)
    const safe = backgroundThemeConfigSchema.safeParse(parsed)
    if (safe.success) {
      return safe.data
    }
  } catch {
    // fallback to defaults
  }
  return {
    ...DEFAULT_BACKGROUND_THEME_CONFIG,
    enabledBuiltInPhases: [...BUILT_IN_PHASE_IDS],
    customColors: [],
  }
}

export function hexToRgbTuple(hex: string): [number, number, number] {
  const clean = normalizeHexColor(hex) || "#1F73FF"
  const r = Number.parseInt(clean.slice(1, 3), 16)
  const g = Number.parseInt(clean.slice(3, 5), 16)
  const b = Number.parseInt(clean.slice(5, 7), 16)
  return [r, g, b]
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0)
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  return [h / 6, s, l]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hn = ((h % 1) + 1) % 1
  if (s === 0) {
    const v = Math.round(l * 255)
    return [v, v, v]
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [
    Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, hn) * 255),
    Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  ]
}

/**
 * Generates a complete dark-obsidian harmonized AmbientColorPhase from any hex color,
 * preserving foreground text readability and 2D/3D shader consistency.
 */
export function buildAmbientPhaseFromHex(name: string, hex: string) {
  const [r, g, b] = hexToRgbTuple(hex)
  const [h, s, l] = rgbToHsl(r, g, b)
  const clampedSat = Math.max(0.45, Math.min(0.98, s || 0.75))
  const baseHue = h
  const accentHue = (h + 0.045) % 1
  const fillHue = (h - 0.04 + 1) % 1

  const primaryRgb: [number, number, number] = [r, g, b]
  const accentRgb = hslToRgb(accentHue, Math.min(1, clampedSat * 0.96), Math.min(0.72, Math.max(0.55, l + 0.1)))
  const softRgb = hslToRgb(accentHue, Math.min(1, clampedSat * 0.85), 0.89)
  const deepRgb = hslToRgb(fillHue, Math.min(0.9, clampedSat * 0.82), 0.1)
  const glowRgb = hslToRgb(baseHue, Math.min(0.95, clampedSat * 0.9), 0.36)
  const bgWashRgb = hslToRgb(baseHue, Math.min(0.88, clampedSat * 0.82), 0.16)

  const norm = (rgb: [number, number, number]): [number, number, number] => [
    Number((rgb[0] / 255).toFixed(3)),
    Number((rgb[1] / 255).toFixed(3)),
    Number((rgb[2] / 255).toFixed(3)),
  ]

  return {
    name,
    baseHue,
    accentHue,
    fillHue,
    primaryRgb,
    accentRgb,
    softRgb,
    deepRgb,
    glowRgb,
    bgWashRgb,
    c1: norm(primaryRgb),
    c2: norm(accentRgb),
    c3: norm(softRgb),
    glow: norm(glowRgb),
    bgB: norm(bgWashRgb),
  }
}

export const SUGGESTED_EXTRA_COLORS: Array<{ name: string; hex: string }> = [
  { name: "Emerald Pulse", hex: "#10B981" },
  { name: "Crimson Blaze", hex: "#EF4444" },
  { name: "Solar Gold", hex: "#F59E0B" },
  { name: "Rose Neon", hex: "#F43F5E" },
  { name: "Lime Cyber", hex: "#84CC16" },
  { name: "Indigo Nova", hex: "#6366F1" },
  { name: "Teal Horizon", hex: "#14B8A6" },
  { name: "Magenta Core", hex: "#EC4899" },
]
