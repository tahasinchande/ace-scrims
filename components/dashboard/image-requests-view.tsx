"use client"

import { useState } from "react"
import type { ImageRequest } from "@/lib/db/schema"
import { ImageRequestCard } from "@/components/dashboard/pending-image-requests"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Camera,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  ImageIcon,
} from "lucide-react"
import Link from "next/link"

export function ImageRequestsView({ requests }: { requests: ImageRequest[] }) {
  const [activeTab, setActiveTab] = useState<"pending" | "submitted" | "all">("all")

  const pendingRequests = requests.filter((r) => r.status === "pending")
  const submittedRequests = requests.filter(
    (r) => r.status === "submitted" || r.status === "approved" || r.status === "rejected"
  )

  const displayedRequests =
    activeTab === "pending"
      ? pendingRequests
      : activeTab === "submitted"
        ? submittedRequests
        : requests

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/20 text-primary border border-primary/30 shadow-md shadow-primary/10">
              <Camera className="size-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-foreground">
                Image Requests
              </h1>
              <p className="text-xs text-muted-foreground">
                Submit high-resolution waist-up player photos for official MVP face banners & match podiums.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {pendingRequests.length > 0 && (
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 px-3 py-1 font-semibold animate-pulse">
                {pendingRequests.length} Pending Upload{pendingRequests.length > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Guidelines & Quality Standards Banner */}
      <div className="rounded-2xl border border-border/80 bg-secondary/30 p-5 backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-2 font-display text-sm font-bold uppercase text-primary mb-3">
          <Sparkles className="size-4" />
          <span>Official MVP Photo Guidelines / ফটো নির্দেশিকা</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-muted-foreground leading-relaxed">
          <div className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-background/50 p-3">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-[10px]">
              1
            </span>
            <div>
              <strong className="text-foreground block font-semibold mb-0.5">
                Waist-Up Portrait (কোমর পর্যন্ত ছবি)
              </strong>
              Take a front-facing or 45-degree angle photo from the waist up in clear indoor or natural lighting.
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-background/50 p-3">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-[10px]">
              2
            </span>
            <div>
              <strong className="text-foreground block font-semibold mb-0.5">
                Background Transparent or Plain
              </strong>
              It is ideal if the background is removed, or taken against a solid, plain wall for clean cutout extraction.
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-background/50 p-3">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-[10px]">
              3
            </span>
            <div>
              <strong className="text-foreground block font-semibold mb-0.5">
                Original Quality (No File Size Limits)
              </strong>
              Upload the original image without compression. PNG, JPG, and WEBP formats are fully accepted.
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-background/50 p-3">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-[10px]">
              4
            </span>
            <div>
              <strong className="text-foreground block font-semibold mb-0.5">
                Fast Turnaround Showcase
              </strong>
              Once submitted, our media design team renders the official tournament banner and publishes it on the results board.
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Filter */}
      {requests.length > 0 && (
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <Button
            variant={activeTab === "all" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("all")}
            className="text-xs font-semibold h-8 rounded-lg"
          >
            All Requests ({requests.length})
          </Button>
          <Button
            variant={activeTab === "pending" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("pending")}
            className="text-xs font-semibold h-8 rounded-lg"
          >
            Pending ({pendingRequests.length})
          </Button>
          <Button
            variant={activeTab === "submitted" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("submitted")}
            className="text-xs font-semibold h-8 rounded-lg"
          >
            Submitted History ({submittedRequests.length})
          </Button>
        </div>
      )}

      {/* Requests List */}
      {displayedRequests.length > 0 ? (
        <div className="flex flex-col gap-6">
          {displayedRequests.map((request) => {
            if (request.status === "pending") {
              return <ImageRequestCard key={request.id} request={request} />
            }

            // Submitted / Historical request card
            const images = (request.uploadedImageUrls as string[]) || []
            return (
              <div
                key={request.id}
                className="glass flex flex-col gap-4 rounded-2xl border border-border/80 bg-secondary/15 p-5 md:p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                  <div>
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Request ID: {request.id.slice(0, 8)}
                    </span>
                    <h3 className="font-display text-lg font-bold text-foreground">
                      {request.scrimTitle || "Tournament Match"} — {request.submittedTeamName || request.teamName}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    {request.status === "submitted" && (
                      <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30">
                        <Clock className="size-3 mr-1" /> Under Review
                      </Badge>
                    )}
                    {request.status === "approved" && (
                      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                        <CheckCircle2 className="size-3 mr-1" /> Banner Published
                      </Badge>
                    )}
                    {request.status === "rejected" && (
                      <Badge className="bg-destructive/15 text-destructive border-destructive/30">
                        <AlertCircle className="size-3 mr-1" /> Re-upload Requested
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground block">Submitted Team Name:</span>
                    <span className="font-semibold text-foreground">
                      {request.submittedTeamName || request.teamName}
                    </span>
                  </div>
                  {(request.submittedPlayerName || request.mvpPlayerName) && (
                    <div>
                      <span className="text-muted-foreground block">MVP Player:</span>
                      <span className="font-semibold text-emerald-400">
                        {request.submittedPlayerName || request.mvpPlayerName}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground block">Player UID:</span>
                    <span className="font-semibold text-foreground font-mono">
                      {request.submittedPlayerUid || request.captainUid || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Submitted On:</span>
                    <span className="font-semibold text-foreground">
                      {request.submittedAt
                        ? new Date(request.submittedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "N/A"}
                    </span>
                  </div>
                </div>

                {/* Photo Previews */}
                {images.length > 0 && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Submitted Photos ({images.length}):
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                      {images.map((url, idx) => (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-background/50 hover:border-primary/50 transition-colors"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`Photo ${idx + 1}`}
                            className="size-full object-contain p-1 group-hover:scale-105 transition-transform"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="glass flex flex-col items-center justify-center gap-4 rounded-3xl border border-border/80 p-12 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-secondary/80 text-muted-foreground border border-border">
            <ImageIcon className="size-8 text-muted-foreground/60" />
          </div>
          <div className="max-w-md">
            <h2 className="font-display text-lg font-bold uppercase tracking-wide text-foreground">
              No Image Requests Found
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              When your team claims victory or an MVP award in RushX Organization, administrators send an official MVP Image Request directly to your account.
            </p>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="outline" size="sm" className="rounded-xl text-xs font-semibold">
              <Link href="/dashboard/scrims">View My Scrims</Link>
            </Button>
            <Button asChild size="sm" className="rounded-xl text-xs font-semibold glow-primary">
              <Link href="/scrims">Book Next Match</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
