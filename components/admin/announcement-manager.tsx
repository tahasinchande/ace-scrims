"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { saveTopAdConfig, broadcastNotification } from "@/app/actions/admin"
import { TopAdShowcase } from "@/components/site/top-ad-showcase"
import { DEFAULT_TOP_AD_CONFIG, type TopAdAccent, type TopAdConfig } from "@/lib/top-ad"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  CalendarClock,
  Check,
  Clock,
  Eye,
  Highlighter,
  Link2,
  Loader2,
  Megaphone,
  Power,
  Radio,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const initialState = { ok: false, error: null as string | null }

const ACCENT_OPTIONS: Array<{
  id: TopAdAccent
  label: string
  swatch: string
  ring: string
}> = [
  { id: "amber", label: "DeepCharts Amber", swatch: "bg-amber-400", ring: "ring-amber-400/60" },
  { id: "blue", label: "Electric Blue", swatch: "bg-[#1f73ff]", ring: "ring-[#1f73ff]/60" },
  { id: "cyan", label: "Cyber Cyan", swatch: "bg-cyan-400", ring: "ring-cyan-400/60" },
  { id: "violet", label: "Violet", swatch: "bg-[#9B5DE5]", ring: "ring-[#9B5DE5]/60" },
  { id: "crimson", label: "Crimson", swatch: "bg-[#D9536F]", ring: "ring-[#D9536F]/60" },
  { id: "emerald", label: "Emerald", swatch: "bg-emerald-400", ring: "ring-emerald-400/60" },
]

function isoToDateTimeLocal(iso: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function dateTimeLocalToIso(localValue: string): string {
  if (!localValue.trim()) return ""
  const d = new Date(localValue)
  if (!Number.isFinite(d.getTime())) return ""
  return d.toISOString()
}

export function AnnouncementManager({
  currentBanner,
  initialTopAd,
}: {
  currentBanner: string
  initialTopAd?: TopAdConfig
}) {
  const baseConfig: TopAdConfig = initialTopAd ?? {
    ...DEFAULT_TOP_AD_CONFIG,
    enabled: Boolean(currentBanner.trim()),
    text: currentBanner,
  }

  const [enabled, setEnabled] = useState(baseConfig.enabled)
  const [badge, setBadge] = useState(baseConfig.badge || "LIMITED OFFER")
  const [accent, setAccent] = useState<TopAdAccent>(baseConfig.accent || "amber")
  const [text, setText] = useState(baseConfig.text || "")
  const [highlightText, setHighlightText] = useState(baseConfig.highlightText || "")
  const [ctaLabel, setCtaLabel] = useState(baseConfig.ctaLabel || "")
  const [ctaUrl, setCtaUrl] = useState(baseConfig.ctaUrl || "")
  const [countdownLocal, setCountdownLocal] = useState(() =>
    isoToDateTimeLocal(baseConfig.countdownEnd)
  )
  const [startsLocal, setStartsLocal] = useState(() => isoToDateTimeLocal(baseConfig.startsAt))
  const [endsLocal, setEndsLocal] = useState(() => isoToDateTimeLocal(baseConfig.endsAt))
  const [dismissible, setDismissible] = useState(baseConfig.dismissible ?? true)
  const [version, setVersion] = useState(baseConfig.version || 1)

  const [isPending, startTransition] = useTransition()
  const [state, formAction, broadcastPending] = useActionState(broadcastNotification, initialState)

  useEffect(() => {
    if (state.ok) toast.success("Broadcast sent to all users")
    else if (state.error) toast.error(state.error)
  }, [state])

  const previewConfig: TopAdConfig = {
    enabled,
    badge: badge.trim(),
    accent,
    text: text.trim() || "UP TO 40% BONUS PRIZE POOL ON TONIGHT'S CHAMPION RUSH",
    highlightText:
      highlightText.trim() || (text.trim() ? "" : "40% BONUS"),
    ctaLabel: ctaLabel.trim() || (ctaUrl.trim() ? "Book Slot" : ""),
    ctaUrl: ctaUrl.trim() || (text.trim() ? "" : "/scrims"),
    countdownEnd: dateTimeLocalToIso(countdownLocal),
    startsAt: dateTimeLocalToIso(startsLocal),
    endsAt: dateTimeLocalToIso(endsLocal),
    dismissible,
    version,
  }

  function handleLoadDeepChartsPreset() {
    const tomorrowIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    setEnabled(true)
    setBadge("Special Event")
    setAccent("amber")
    setText("UP TO 40% BONUS PRIZE POOL ON TONIGHT'S CHAMPION RUSH")
    setHighlightText("40% BONUS")
    setCtaLabel("Book Slot")
    setCtaUrl("/scrims")
    setCountdownLocal(isoToDateTimeLocal(tomorrowIso))
    setDismissible(true)
    toast.success("Loaded DeepCharts-style preset — customize and click Save & Publish!")
  }

  function handleSaveTopAd(overrideEnabled?: boolean) {
    const nextEnabled = overrideEnabled !== undefined ? overrideEnabled : enabled
    startTransition(async () => {
      try {
        const res = await saveTopAdConfig({
          enabled: nextEnabled,
          badge: badge.trim(),
          accent,
          text: text.trim(),
          highlightText: highlightText.trim(),
          ctaLabel: ctaLabel.trim(),
          ctaUrl: ctaUrl.trim(),
          countdownEnd: dateTimeLocalToIso(countdownLocal),
          startsAt: dateTimeLocalToIso(startsLocal),
          endsAt: dateTimeLocalToIso(endsLocal),
          dismissible,
        })
        if (!res.ok) {
          toast.error(res.error || "Failed to save Top Ad showcase")
          return
        }
        setEnabled(nextEnabled)
        if (res.version) setVersion(res.version)
        toast.success(
          nextEnabled
            ? "Top Ad / Announcement Showcase published live!"
            : "Top Ad Showcase turned off."
        )
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save Top Ad showcase")
      }
    })
  }

  function handleClearAll() {
    setEnabled(false)
    setBadge("LIMITED OFFER")
    setAccent("amber")
    setText("")
    setHighlightText("")
    setCtaLabel("")
    setCtaUrl("")
    setCountdownLocal("")
    setStartsLocal("")
    setEndsLocal("")
    setDismissible(true)
    startTransition(async () => {
      const res = await saveTopAdConfig({
        ...DEFAULT_TOP_AD_CONFIG,
        enabled: false,
        text: "",
        highlightText: "",
        ctaLabel: "",
        ctaUrl: "",
      })
      if (res.ok) {
        toast.success("Top Ad Showcase cleared and hidden")
      } else {
        toast.error(res.error || "Failed to clear Top Ad showcase")
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top Ad / Announcement Showcase Builder */}
      <section className="dc-surface flex flex-col gap-5 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-white">
              <Megaphone className="size-4 text-primary" />
              Top Ad &amp; Announcement Showcase
            </h2>
            <p className="text-xs text-muted-foreground">
              Clean DeepCharts-style editorial promo bar rendered above site navigation with metallic event mark, inline highlighted text, stacked tabular countdown columns, understated CTA link, and schedule window.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLoadDeepChartsPreset}
              className="gap-1.5 rounded-xl border-amber-400/35 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 hover:text-amber-100"
            >
              <Wand2 className="size-3.5" />
              Load DeepCharts Preset
            </Button>

            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled((prev) => !prev)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all duration-200 cursor-pointer",
                enabled
                  ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300 shadow-xs"
                  : "border-white/10 bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.07]"
              )}
            >
              <Power className="size-3.5" />
              <span>{enabled ? "Showcase Active" : "Showcase Off"}</span>
            </button>
          </div>
        </div>

        {/* Live Preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Eye className="size-3.5 text-accent" />
              Live Top Banner Preview
            </span>
            <span className={enabled ? "text-emerald-400" : "text-zinc-500"}>
              {enabled ? "Visible to Visitors" : "Hidden (Toggle Active to Publish)"}
            </span>
          </div>
          <div className="rounded-xl border border-dashed border-white/[0.12] bg-[#050508]/80 p-2.5">
            <TopAdShowcase config={previewConfig} preview />
          </div>
        </div>

        {/* Content, Badge & Inline Highlight */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="top-ad-badge">Center Event Mark</Label>
            <Input
              id="top-ad-badge"
              value={badge}
              onChange={(e) => setBadge(e.target.value)}
              maxLength={32}
              placeholder="e.g. Special Event, Champion Rush"
            />
          </div>

          <div className="flex flex-col gap-1.5 md:col-span-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="top-ad-text">Promo / Announcement Text</Label>
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                {text.length}/180
              </span>
            </div>
            <Input
              id="top-ad-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={180}
              placeholder="e.g. Tonight's Champion Rush Scrim — Extra ৳1,000 Bonus Prize Pool ends soon!"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="top-ad-highlight" className="flex items-center gap-1.5">
            <Highlighter className="size-3.5 text-amber-400" />
            Inline Highlighted Phrase (optional — bolded in accent color inside your promo text)
          </Label>
          <Input
            id="top-ad-highlight"
            value={highlightText}
            onChange={(e) => setHighlightText(e.target.value)}
            maxLength={60}
            placeholder="e.g. Extra ৳1,000 Bonus Prize Pool"
          />
        </div>

        {/* Accent Color Swatches */}
        <div className="flex flex-col gap-2">
          <Label className="flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            Banner Accent Theme
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            {ACCENT_OPTIONS.map((opt) => {
              const selected = accent === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setAccent(opt.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all duration-150 cursor-pointer",
                    selected
                      ? cn("border-white/30 bg-white/[0.1] text-white ring-2", opt.ring)
                      : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.07] hover:text-white"
                  )}
                >
                  <span className={cn("size-2.5 rounded-full", opt.swatch)} />
                  <span>{opt.label}</span>
                  {selected && <Check className="size-3 text-white" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Destination CTA Link */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="top-ad-cta-label">CTA Button Label (optional)</Label>
            <Input
              id="top-ad-cta-label"
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              maxLength={32}
              placeholder="e.g. Book Slot, Claim Offer, Watch Now"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="top-ad-cta-url" className="flex items-center gap-1.5">
              <Link2 className="size-3.5 text-accent" />
              Destination Link (https:// or /path)
            </Label>
            <Input
              id="top-ad-cta-url"
              value={ctaUrl}
              onChange={(e) => setCtaUrl(e.target.value)}
              maxLength={500}
              placeholder="e.g. /scrims or https://discord.gg/..."
            />
          </div>
        </div>

        {/* Countdown Timer & Schedule Window */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="top-ad-countdown" className="flex items-center gap-1.5">
              <Clock className="size-3.5 text-accent" />
              Countdown Target (optional)
            </Label>
            <Input
              id="top-ad-countdown"
              type="datetime-local"
              value={countdownLocal}
              onChange={(e) => setCountdownLocal(e.target.value)}
            />
            <span className="text-[11px] text-muted-foreground">
              Displays clean 4-part tabular countdown (days : hours : minutes : seconds).
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="top-ad-starts" className="flex items-center gap-1.5">
              <CalendarClock className="size-3.5 text-primary" />
              Schedule Start (optional)
            </Label>
            <Input
              id="top-ad-starts"
              type="datetime-local"
              value={startsLocal}
              onChange={(e) => setStartsLocal(e.target.value)}
            />
            <span className="text-[11px] text-muted-foreground">
              Leave blank to show immediately once enabled.
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="top-ad-ends" className="flex items-center gap-1.5">
              <CalendarClock className="size-3.5 text-[#D9536F]" />
              Auto-Expiry Time (optional)
            </Label>
            <Input
              id="top-ad-ends"
              type="datetime-local"
              value={endsLocal}
              onChange={(e) => setEndsLocal(e.target.value)}
            />
            <span className="text-[11px] text-muted-foreground">
              Automatically hides the banner after expiry.
            </span>
          </div>
        </div>

        {/* Dismiss Toggle & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.08] pt-4">
          <label className="inline-flex items-center gap-2.5 text-xs font-medium text-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dismissible}
              onChange={(e) => setDismissible(e.target.checked)}
              className="size-4 rounded border-white/20 bg-black/40 accent-primary cursor-pointer"
            />
            Allow visitors to dismiss this banner (reappears if you publish a new update)
          </label>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              type="button"
              onClick={() => handleSaveTopAd()}
              disabled={isPending}
              className="font-display font-bold uppercase tracking-wide"
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {enabled ? "Save & Publish Showcase" : "Save Draft (Off)"}
            </Button>

            {enabled && (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSaveTopAd(false)}
                disabled={isPending}
              >
                Turn Off
              </Button>
            )}

            {(text || badge || highlightText || ctaUrl || countdownLocal) && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleClearAll}
                disabled={isPending}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Broadcast Notification Form */}
      <section className="dc-surface flex flex-col gap-4 rounded-2xl p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide">
          <Radio className="size-4 text-chart-3" />
          Broadcast Notification
        </h2>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="broadcast-title">Title</Label>
            <Input id="broadcast-title" name="title" required minLength={3} maxLength={120} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="broadcast-body">Message (optional)</Label>
            <Textarea id="broadcast-body" name="body" rows={3} maxLength={500} />
          </div>
          <div>
            <Button
              type="submit"
              disabled={broadcastPending}
              className="font-display font-bold uppercase"
            >
              {broadcastPending && <Loader2 className="size-4 animate-spin" />}
              Send to All Users
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}
