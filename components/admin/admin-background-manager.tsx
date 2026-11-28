"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Palette,
  Clock,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Loader2,
  Sparkles,
  Check,
  Star,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BUILT_IN_PHASE_IDS,
  DEFAULT_BACKGROUND_THEME_CONFIG,
  HEX_COLOR_RE,
  SUGGESTED_EXTRA_COLORS,
  normalizeHexColor,
  type BackgroundThemeConfig,
  type BuiltInPhaseId,
} from "@/lib/background-config"
import { saveBackgroundThemeConfigAction } from "@/app/actions/admin"

const BUILT_IN_META: Record<
  BuiltInPhaseId,
  { label: string; description: string; hex: string; accentHex: string }
> = {
  "electric-blue": {
    label: "Electric Blue",
    description: "Default opening cyber neon blue & ice cyan",
    hex: "#1F73FF",
    accentHex: "#38BDF8",
  },
  "cyber-violet": {
    label: "Cyber Violet",
    description: "Deep amethyst violet & ultraviolet glow",
    hex: "#8C44D4",
    accentHex: "#A78BFA",
  },
  "cyber-orange": {
    label: "Cyber Orange",
    description: "Signature molten amber & RushX orange",
    hex: "#F97316",
    accentHex: "#FBBF24",
  },
  "neon-orchid": {
    label: "Neon Orchid",
    description: "Vibrant orchid magenta & plasma highlight",
    hex: "#C038E8",
    accentHex: "#E879F9",
  },
  "electric-cyan": {
    label: "Electric Cyan",
    description: "Crisp cyan laser & bright aqua horizon",
    hex: "#06B6D4",
    accentHex: "#38BDF8",
  },
}

function broadcastBackgroundConfig(config: BackgroundThemeConfig) {
  if (typeof window === "undefined") return
  try {
    window.dispatchEvent(new CustomEvent("rushx:background-updated", { detail: config }))
  } catch {
    // ignore
  }
  try {
    if ("BroadcastChannel" in window) {
      const ch = new BroadcastChannel("rushx-theme")
      ch.postMessage({ type: "background-config", config })
      ch.close()
    }
  } catch {
    // ignore
  }
}

export function AdminBackgroundManager({
  initialConfig,
}: {
  initialConfig: BackgroundThemeConfig
}) {
  const router = useRouter()
  const [saving, startSave] = useTransition()
  const [activeTab, setActiveTab] = useState<"timing" | "palette">("timing")
  const [config, setConfig] = useState<BackgroundThemeConfig>(initialConfig)

  const [newColorName, setNewColorName] = useState("")
  const [newColorHex, setNewColorHex] = useState("#10B981")

  const activeRotationSwatches = useMemo(() => {
    const builtIns = BUILT_IN_PHASE_IDS.filter((id) =>
      config.enabledBuiltInPhases.includes(id)
    ).map((id) => ({
      id,
      name: BUILT_IN_META[id].label,
      hex: BUILT_IN_META[id].hex,
      kind: "Built-in" as const,
    }))
    const customs = config.customColors.map((c) => ({
      id: c.id,
      name: c.name,
      hex: c.hex,
      kind: "Custom" as const,
    }))
    const combined = [...builtIns, ...customs]
    const primaryId = config.initialPrimaryColorId
    if (primaryId && combined.length > 1) {
      const idx = combined.findIndex((s) => s.id === primaryId)
      if (idx > 0) {
        return [...combined.slice(idx), ...combined.slice(0, idx)]
      }
    }
    return combined
  }, [config.enabledBuiltInPhases, config.customColors, config.initialPrimaryColorId])

  const effectiveInitialColorId = activeRotationSwatches[0]?.id ?? "electric-blue"

  const totalCycleSeconds = useMemo(() => {
    const count = Math.max(1, activeRotationSwatches.length)
    return Number((count * (config.delaySeconds + config.transitionSeconds)).toFixed(1))
  }, [activeRotationSwatches.length, config.delaySeconds, config.transitionSeconds])

  function setInitialPrimaryColor(id: string) {
    setConfig((prev) => ({
      ...prev,
      initialPrimaryColorId: id,
    }))
  }

  function toggleBuiltIn(id: BuiltInPhaseId) {
    setConfig((prev) => {
      const exists = prev.enabledBuiltInPhases.includes(id)
      const nextBuiltIn = exists
        ? prev.enabledBuiltInPhases.filter((item) => item !== id)
        : [...prev.enabledBuiltInPhases, id]

      if (nextBuiltIn.length === 0 && prev.customColors.length === 0) {
        toast.error("Keep at least one active color in the background palette.")
        return prev
      }
      const nextInitial =
        prev.initialPrimaryColorId === id && exists
          ? nextBuiltIn[0] ?? prev.customColors[0]?.id
          : prev.initialPrimaryColorId
      return {
        ...prev,
        enabledBuiltInPhases: nextBuiltIn,
        initialPrimaryColorId: nextInitial,
      }
    })
  }

  function addCustomColor(nameRaw: string, hexRaw: string) {
    const cleanHex = normalizeHexColor(hexRaw)
    if (!HEX_COLOR_RE.test(cleanHex)) {
      toast.error("Enter a valid hex color (e.g. #10B981).")
      return
    }
    const cleanName = nameRaw.trim() || `Custom ${cleanHex}`
    if (config.customColors.length >= 16) {
      toast.error("Maximum 16 custom colors allowed.")
      return
    }
    if (config.customColors.some((c) => c.hex.toUpperCase() === cleanHex.toUpperCase())) {
      toast.error(`${cleanHex} is already in your palette.`)
      return
    }
    const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    setConfig((prev) => ({
      ...prev,
      customColors: [...prev.customColors, { id, name: cleanName.slice(0, 32), hex: cleanHex }],
    }))
    setNewColorName("")
    toast.success(`Added ${cleanName} (${cleanHex}) to palette — click Save to apply live.`)
  }

  function removeCustomColor(id: string) {
    setConfig((prev) => {
      const nextCustom = prev.customColors.filter((c) => c.id !== id)
      if (prev.enabledBuiltInPhases.length === 0 && nextCustom.length === 0) {
        toast.error("Keep at least one active color in the background palette.")
        return prev
      }
      const nextInitial =
        prev.initialPrimaryColorId === id
          ? prev.enabledBuiltInPhases[0] ?? nextCustom[0]?.id
          : prev.initialPrimaryColorId
      return {
        ...prev,
        customColors: nextCustom,
        initialPrimaryColorId: nextInitial,
      }
    })
  }

  function handleResetDefaults() {
    setConfig({
      ...DEFAULT_BACKGROUND_THEME_CONFIG,
      enabledBuiltInPhases: [...BUILT_IN_PHASE_IDS],
      customColors: [],
      initialPrimaryColorId: DEFAULT_BACKGROUND_THEME_CONFIG.initialPrimaryColorId,
    })
    toast.info("Restored default timing, primary first-load color & palette — click Save to apply.")
  }

  function handleSave() {
    if (config.enabledBuiltInPhases.length === 0 && config.customColors.length === 0) {
      toast.error("Select at least one built-in or custom color.")
      return
    }
    startSave(async () => {
      const res = await saveBackgroundThemeConfigAction(config)
      if (!res.ok || !res.config) {
        toast.error(res.error || "Failed to save background settings.")
        return
      }
      setConfig(res.config)
      broadcastBackgroundConfig(res.config)
      toast.success("Live background timing & color palette updated across 2D & 3D modes!")
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight flex items-center gap-2.5">
            <Palette className="size-7 text-primary" />
            Background Controls
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Control the site-wide color-changing delay interval and build a custom live color
            palette synced across both 2D Ambient and 3D Cyber backgrounds (plus auto-matching Ads).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetDefaults}
            disabled={saving}
          >
            <RotateCcw className="mr-1.5 size-4" />
            Reset Defaults
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="glow-primary font-semibold"
          >
            {saving ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 size-4" />
            )}
            Save Background Settings
          </Button>
        </div>
      </div>

      {/* Active Rotation Preview Strip */}
      <Card className="border-primary/25">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                Active Live Color Rotation ({activeRotationSwatches.length} color
                {activeRotationSwatches.length === 1 ? "" : "s"})
              </CardTitle>
              <CardDescription>
                Holds each color for <strong className="text-foreground">{config.delaySeconds}s</strong>{" "}
                then glides smoothly for{" "}
                <strong className="text-foreground">{config.transitionSeconds}s</strong> (Full loop:{" "}
                <strong className="text-foreground">{totalCycleSeconds}s</strong>).
              </CardDescription>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              2D + 3D Synced
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div
            className="h-3.5 w-full rounded-full border border-white/15 shadow-inner"
            style={{
              background:
                activeRotationSwatches.length === 1
                  ? activeRotationSwatches[0].hex
                  : `linear-gradient(90deg, ${activeRotationSwatches
                      .map((s) => s.hex)
                      .join(", ")})`,
            }}
          />
          <div className="flex flex-wrap gap-2">
            {activeRotationSwatches.map((swatch, idx) => (
              <button
                key={swatch.id}
                type="button"
                onClick={() => setInitialPrimaryColor(swatch.id)}
                title={
                  idx === 0
                    ? "Active initial first-load primary color"
                    : `Click to make ${swatch.name} the first-load primary color`
                }
                className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs transition-colors cursor-pointer ${
                  idx === 0
                    ? "border-primary/60 bg-primary/15 text-foreground shadow-sm"
                    : "dc-metric-cell hover:border-primary/40"
                }`}
              >
                <span className="font-mono text-[10px] text-muted-foreground">
                  {idx === 0 ? "#1 First Load" : `#${idx + 1}`}
                </span>
                <span
                  className="size-3 rounded-full border border-white/25"
                  style={{ backgroundColor: swatch.hex }}
                />
                <span className="font-medium text-foreground">{swatch.name}</span>
                <code className="font-mono text-[10px] text-muted-foreground">{swatch.hex}</code>
              </button>
            ))}
          </div>

          {/* Initial Primary Color (First Load) Selector */}
          <div className="dc-metric-cell mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl p-3.5">
            <div className="min-w-0">
              <Label
                htmlFor="initialPrimaryColorSelect"
                className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground"
              >
                <Star className="size-3.5 text-amber-400" />
                Initial Primary Color (First Site Load)
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Choose the exact color visitors see immediately when the site loads for the first time before rotation begins.
              </p>
            </div>
            <select
              id="initialPrimaryColorSelect"
              value={effectiveInitialColorId}
              onChange={(e) => setInitialPrimaryColor(e.target.value)}
              className="h-9 min-w-[200px] rounded-lg border border-white/15 bg-[#060b1a] px-3 text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
            >
              {activeRotationSwatches.map((swatch) => (
                <option key={swatch.id} value={swatch.id}>
                  {swatch.name} ({swatch.hex})
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Section Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
        <Button
          type="button"
          variant={activeTab === "timing" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("timing")}
          className="gap-1.5"
        >
          <Clock className="size-4" />
          Delay Interval &amp; Timing
        </Button>
        <Button
          type="button"
          variant={activeTab === "palette" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("palette")}
          className="gap-1.5"
        >
          <Palette className="size-4" />
          Color Palette ({activeRotationSwatches.length} Active)
        </Button>
      </div>

      {/* Tab 1: Delay Interval */}
      {activeTab === "timing" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Color-Changing Delay Interval</CardTitle>
            <CardDescription>
              Adjust how long each background color stays active before smoothly transitioning to
              the next color in the palette.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="dc-metric-cell space-y-3 rounded-xl p-4">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="delaySeconds" className="font-semibold">
                    Color Hold Delay Interval (Seconds)
                  </Label>
                  <Badge variant="secondary" className="font-mono">
                    {config.delaySeconds}s
                  </Badge>
                </div>
                <input
                  id="delaySecondsSlider"
                  type="range"
                  min={0.5}
                  max={60}
                  step={0.5}
                  value={config.delaySeconds}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      delaySeconds: Math.min(60, Math.max(0.5, Number(e.target.value) || 0.5)),
                    }))
                  }
                  className="w-full accent-primary cursor-pointer"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id="delaySeconds"
                    type="number"
                    min={0.5}
                    max={60}
                    step={0.1}
                    value={config.delaySeconds}
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      setConfig((c) => ({
                        ...c,
                        delaySeconds: Number.isFinite(val) ? Math.min(60, Math.max(0.5, val)) : 2.2,
                      }))
                    }}
                    className="w-24 font-mono"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {[1, 2.2, 5, 10, 20, 30].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setConfig((c) => ({ ...c, delaySeconds: preset }))}
                        className={`rounded-md border px-2 py-1 text-xs font-mono transition-colors cursor-pointer ${
                          Math.abs(config.delaySeconds - preset) < 0.05
                            ? "border-primary bg-primary/15 text-primary font-semibold"
                            : "border-white/10 bg-[#050914]/60 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {preset}s
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Controls how long the site rests on each color before starting the next color shift.
                </p>
              </div>

              <div className="dc-metric-cell space-y-3 rounded-xl p-4">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="transitionSeconds" className="font-semibold">
                    Smooth Color Glide Duration (Seconds)
                  </Label>
                  <Badge variant="secondary" className="font-mono">
                    {config.transitionSeconds}s
                  </Badge>
                </div>
                <input
                  id="transitionSecondsSlider"
                  type="range"
                  min={0.5}
                  max={20}
                  step={0.5}
                  value={config.transitionSeconds}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      transitionSeconds: Math.min(20, Math.max(0.5, Number(e.target.value) || 0.5)),
                    }))
                  }
                  className="w-full accent-primary cursor-pointer"
                />
                <div className="flex items-center gap-2">
                  <Input
                    id="transitionSeconds"
                    type="number"
                    min={0.5}
                    max={20}
                    step={0.1}
                    value={config.transitionSeconds}
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      setConfig((c) => ({
                        ...c,
                        transitionSeconds: Number.isFinite(val)
                          ? Math.min(20, Math.max(0.5, val))
                          : 4.2,
                      }))
                    }}
                    className="w-28 font-mono"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {[1.5, 3, 4.2, 6, 10].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setConfig((c) => ({ ...c, transitionSeconds: preset }))}
                        className={`rounded-md border px-2 py-1 text-xs font-mono transition-colors cursor-pointer ${
                          Math.abs(config.transitionSeconds - preset) < 0.05
                            ? "border-primary bg-primary/15 text-primary font-semibold"
                            : "border-border bg-background/60 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {preset}s
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Controls how smoothly the shader &amp; lights morph from one color to the next.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 2: Color Palette Selection */}
      {activeTab === "palette" && (
        <div className="space-y-6">
          {/* Built-in Spectrum Phases */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Built-In Signature Colors</CardTitle>
              <CardDescription>
                Toggle which core RushX spectrum colors are included in the automatic rotation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {BUILT_IN_PHASE_IDS.map((id) => {
                  const meta = BUILT_IN_META[id]
                  const active = config.enabledBuiltInPhases.includes(id)
                  const isFirstLoad = effectiveInitialColorId === id
                  return (
                    <div
                      key={id}
                      className={`flex flex-col justify-between gap-2.5 rounded-xl border p-3.5 transition-all ${
                        active
                          ? "dc-metric-cell border-primary/55 shadow-sm"
                          : "border-white/10 bg-[#060b1a]/45 opacity-65 hover:opacity-100"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleBuiltIn(id)}
                        className="flex items-start gap-3 text-left cursor-pointer"
                      >
                        <span
                          className="mt-0.5 size-8 shrink-0 rounded-lg border border-white/25 shadow-md flex items-center justify-center"
                          style={{
                            background: `linear-gradient(135deg, ${meta.hex}, ${meta.accentHex})`,
                          }}
                        >
                          {active && <Check className="size-4 text-white drop-shadow" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-sm text-foreground">
                              {meta.label}
                            </span>
                            <code className="font-mono text-[10px] text-muted-foreground">
                              {meta.hex}
                            </code>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                            {meta.description}
                          </p>
                        </div>
                      </button>
                      {active && (
                        <div className="flex items-center justify-end border-t border-white/[0.06] pt-2">
                          <button
                            type="button"
                            onClick={() => setInitialPrimaryColor(id)}
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                              isFirstLoad
                                ? "bg-amber-500/20 text-amber-300 border border-amber-400/40"
                                : "text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
                            }`}
                          >
                            <Star className="size-3" />
                            {isFirstLoad ? "Primary First Load" : "Set as First Load"}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Add Extra Custom Colors */}
          <Card className="border-primary/25">
            <CardHeader>
              <CardTitle className="text-lg">Add Extra Colors to Rotation</CardTitle>
              <CardDescription>
                Pick any exact custom hex color or tap a suggested swatch to add it into the live
                2D &amp; 3D background color rotation (up to 16 extra colors).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Custom Hex Picker Row */}
              <div className="dc-metric-cell grid gap-3 sm:grid-cols-[auto_1fr_1fr_auto] items-end rounded-xl p-4">
                <div className="space-y-1.5">
                  <Label htmlFor="customColorPicker" className="text-xs">
                    Swatch
                  </Label>
                  <input
                    id="customColorPicker"
                    type="color"
                    value={normalizeHexColor(newColorHex) || "#10B981"}
                    onChange={(e) => setNewColorHex(e.target.value.toUpperCase())}
                    className="h-10 w-14 cursor-pointer rounded-md border border-border bg-background p-1"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="customColorHex" className="text-xs">
                    Hex Color (#RRGGBB)
                  </Label>
                  <Input
                    id="customColorHex"
                    value={newColorHex}
                    onChange={(e) => setNewColorHex(e.target.value.toUpperCase())}
                    placeholder="#10B981"
                    maxLength={7}
                    className="font-mono uppercase"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="customColorName" className="text-xs">
                    Color Label
                  </Label>
                  <Input
                    id="customColorName"
                    value={newColorName}
                    onChange={(e) => setNewColorName(e.target.value)}
                    placeholder="e.g. Emerald Pulse"
                    maxLength={32}
                  />
                </div>
                <Button
                  type="button"
                  onClick={() => addCustomColor(newColorName, newColorHex)}
                  className="h-10 font-semibold"
                >
                  <Plus className="mr-1.5 size-4" />
                  Add Color
                </Button>
              </div>

              {/* Suggested Quick-Add Swatches */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Quick-Add Extra Palette Colors
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_EXTRA_COLORS.map((preset) => {
                    const alreadyAdded = config.customColors.some(
                      (c) => c.hex.toUpperCase() === preset.hex.toUpperCase()
                    )
                    return (
                      <button
                        key={preset.hex}
                        type="button"
                        disabled={alreadyAdded}
                        onClick={() => addCustomColor(preset.name, preset.hex)}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          alreadyAdded
                            ? "border-primary/40 bg-primary/10 text-primary cursor-default"
                            : "border-border/70 bg-secondary/25 text-foreground hover:border-primary/50 cursor-pointer"
                        }`}
                      >
                        <span
                          className="size-3.5 rounded-full border border-white/25"
                          style={{ backgroundColor: preset.hex }}
                        />
                        <span>{preset.name}</span>
                        {alreadyAdded ? (
                          <Check className="size-3.5 text-primary" />
                        ) : (
                          <Plus className="size-3 text-muted-foreground" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Added Custom Colors List */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Added Custom Colors ({config.customColors.length} / 16)
                </p>
                {config.customColors.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 py-6 text-center text-xs text-muted-foreground">
                    No extra custom colors added yet. Pick a color above to expand the background
                    spectrum.
                  </div>
                ) : (
                  <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {config.customColors.map((color) => {
                      const isFirstLoad = effectiveInitialColorId === color.id
                      return (
                        <div
                          key={color.id}
                          className="dc-metric-cell flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="size-7 shrink-0 rounded-lg border border-white/25 shadow"
                              style={{ backgroundColor: color.hex }}
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">{color.name}</p>
                              <code className="font-mono text-[11px] text-muted-foreground">
                                {color.hex}
                              </code>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setInitialPrimaryColor(color.id)}
                              title={isFirstLoad ? "Primary First Load Color" : "Set as Primary First Load Color"}
                              aria-label={`Set ${color.name} as primary first load color`}
                              className={
                                isFirstLoad
                                  ? "text-amber-400 bg-amber-500/15"
                                  : "text-muted-foreground hover:text-amber-300"
                              }
                            >
                              <Star className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeCustomColor(color.id)}
                              aria-label={`Remove ${color.name}`}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
