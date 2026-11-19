import "server-only"

import { GoogleGenAI, Type } from "@google/genai"
import { db, ensureSchemaReady } from "@/lib/db"
import { notices, results, tutorials } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"
import { getActiveScrims, getBangladeshActiveDate } from "@/lib/queries/scrims"
import { getActivePayoutMethods } from "@/lib/queries/payout-methods"
import { getPublicSiteSettings } from "@/lib/queries/settings"

const MODEL_ID = "gemini-4-hydrogen"
const FALLBACK_MODEL_ID = "gemini-3.1-flash-lite"

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim()
  if (!apiKey) return null
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  })
}

function isTransientGeminiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || "")
  const status = (err as { status?: number; code?: number })?.status ?? (err as { code?: number })?.code
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    /503|429|UNAVAILABLE|overloaded|timeout|timed out|ECONNRESET|ETIMEDOUT|fetch failed/i.test(msg)
  )
}

async function generateWithRetry(
  ai: GoogleGenAI,
  params: Omit<Parameters<GoogleGenAI["models"]["generateContent"]>[0], "model">,
) {
  const attempts: Array<{ model: string; delayMs: number }> = [
    { model: MODEL_ID, delayMs: 0 },
    { model: MODEL_ID, delayMs: 450 },
    { model: FALLBACK_MODEL_ID, delayMs: 0 },
  ]

  let lastErr: unknown
  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i]
    if (attempt.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, attempt.delayMs))
    }
    try {
      return await ai.models.generateContent({
        ...params,
        model: attempt.model,
      })
    } catch (err) {
      lastErr = err
      const shouldContinue = i < attempts.length - 1 && (isTransientGeminiError(err) || attempt.model !== FALLBACK_MODEL_ID)
      if (!shouldContinue) {
        throw err
      }
      console.warn(`[AI Support] Gemini attempt ${i + 1} (${attempt.model}) failed, falling back:`, err instanceof Error ? err.message : err)
    }
  }
  throw lastErr
}

export type ModerationResult = {
  flagged: boolean
  isAbusive: boolean
  isNsfw: boolean
  category: "abusive" | "nsfw" | "harassment" | "none"
  confidence: number
  reason: string
  detectorSource: "regex" | "gemini" | "none"
}

// Fast Layer-1 regex pre-filter for severe slurs, explicit 18+/NSFW, and extreme abusive words (EN + common Banglish/BN)
const EXTREME_ABUSIVE_PATTERNS: Array<{ pattern: RegExp; category: "abusive" | "nsfw" | "harassment"; reason: string }> = [
  {
    pattern: /\b(porn|pornhub|xnxx|xvideos|hentai|nsfw|nude|nudes|blowjob|handjob|dickpic|pussy|boobs|vagina|penis|slut|whore|rape|rapist|onlyfans|sex\s*chat|send\s*nudes)\b/i,
    category: "nsfw",
    reason: "Explicit 18+ / NSFW content detected in chat message.",
  },
  {
    pattern: /\b(madarchod|maderchod|banchod|baanchod|choda|chodna|khanki|magi|randi|haramjada|harami|bokachoda|kuttar\s*baccha|motherfucker|cocksucker|faggot|nigger|nigga)\b/i,
    category: "abusive",
    reason: "Severe abusive language or slur detected.",
  },
  {
    pattern: /(মাগি|খানকি|মাদারচোদ|বাইনচোদ|চোদা|বোকাচোদা|নটি|সেক্স|পর্ন|ন্যুড)/i,
    category: "abusive",
    reason: "Abusive or explicit Bengali language detected.",
  },
]

export async function moderateUserMessage(messageText: string): Promise<ModerationResult> {
  const text = (messageText || "").trim()
  if (!text) {
    return {
      flagged: false,
      isAbusive: false,
      isNsfw: false,
      category: "none",
      confidence: 0,
      reason: "",
      detectorSource: "none",
    }
  }

  for (const rule of EXTREME_ABUSIVE_PATTERNS) {
    if (rule.pattern.test(text)) {
      return {
        flagged: true,
        isAbusive: rule.category !== "nsfw",
        isNsfw: rule.category === "nsfw",
        category: rule.category,
        confidence: 99,
        reason: rule.reason,
        detectorSource: "regex",
      }
    }
  }

  const ai = getGeminiClient()
  if (!ai) {
    return {
      flagged: false,
      isAbusive: false,
      isNsfw: false,
      category: "none",
      confidence: 0,
      reason: "",
      detectorSource: "none",
    }
  }

  try {
    const response = await generateWithRetry(ai, {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Analyze this player live-support chat message for severe safety violations.
Flag ONLY if the message genuinely contains:
1. Severe abusive language, profanity directed at staff/players, hate speech, threats, or slurs (English, Bengali, or Banglish).
2. Explicit 18+/NSFW sexual content or solicitation.
Do NOT flag normal esports frustration, payment complaints, bug reports, "hacker", "kill", "booyah", or polite questions.

Message: """${text}"""`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isAbusive: { type: Type.BOOLEAN },
            isNsfw: { type: Type.BOOLEAN },
            category: { type: Type.STRING },
            confidence: { type: Type.INTEGER },
            reason: { type: Type.STRING },
          },
          required: ["isAbusive", "isNsfw", "category", "confidence", "reason"],
        },
      },
    })

    const raw = response.text?.trim() || "{}"
    const parsed = JSON.parse(raw) as {
      isAbusive?: boolean
      isNsfw?: boolean
      category?: string
      confidence?: number
      reason?: string
    }

    const confidence = Math.min(100, Math.max(0, Number(parsed.confidence ?? 0)))
    const isAbusive = Boolean(parsed.isAbusive)
    const isNsfw = Boolean(parsed.isNsfw)
    const flagged = (isAbusive || isNsfw) && confidence >= 75

    const catRaw = (parsed.category || "").toLowerCase()
    const category: "abusive" | "nsfw" | "harassment" | "none" = !flagged
      ? "none"
      : isNsfw || catRaw.includes("nsfw")
        ? "nsfw"
        : catRaw.includes("harass")
          ? "harassment"
          : "abusive"

    return {
      flagged,
      isAbusive,
      isNsfw,
      category,
      confidence,
      reason: parsed.reason?.trim() || "Policy violation detected by AI moderation.",
      detectorSource: "gemini",
    }
  } catch (err) {
    console.warn("[AI Moderation] Gemini classifier failed, skipping Layer-2:", err)
    return {
      flagged: false,
      isAbusive: false,
      isNsfw: false,
      category: "none",
      confidence: 0,
      reason: "",
      detectorSource: "none",
    }
  }
}

/**
 * Collects strictly PUBLIC database context for ACE AI Support.
 * NEVER exposes Room IDs, Room Passwords, private user PII, emails, phone numbers, or payment records.
 */
export async function buildPublicPlatformContext(): Promise<string> {
  try {
    await ensureSchemaReady()

    const [activeScrims, recentResults, activeNotices, recentTutorials, payoutList, siteSettings] =
      await Promise.all([
        getActiveScrims().catch(() => []),
        db
          .select({
            winningTeam: results.winningTeam,
            kills: results.kills,
            prizeBdt: results.prizeBdt,
            placement: results.placement,
            category: results.category,
            matchDate: results.matchDate,
          })
          .from(results)
          .where(eq(results.isTrashed, false))
          .orderBy(desc(results.createdAt))
          .limit(8)
          .catch(() => []),
        db
          .select({
            title: notices.title,
            content: notices.content,
            category: notices.category,
            priority: notices.priority,
          })
          .from(notices)
          .where(eq(notices.isPublished, true))
          .orderBy(desc(notices.isPinned), desc(notices.createdAt))
          .limit(6)
          .catch(() => []),
        db
          .select({
            title: tutorials.title,
            description: tutorials.description,
          })
          .from(tutorials)
          .orderBy(desc(tutorials.createdAt))
          .limit(5)
          .catch(() => []),
        getActivePayoutMethods().catch(() => []),
        getPublicSiteSettings().catch(() => null),
      ])

    const activeDate = getBangladeshActiveDate()
    const scrimLines = activeScrims.slice(0, 20).map((s) => {
      const displayTeams = s.publicConfirmedTeams ?? s.confirmedTeams ?? 0
      const openSeats = Math.max(0, (s.maxTeams || 12) - displayTeams)
      return `- ${s.title} | Time: ${s.startTime} | Map: ${s.map} | Category: ${s.category || "Daily Scrims"} | Entry: ৳${s.priceBdt} | Prize Pool: ৳${s.prizePoolBdt} | Slots: ${displayTeams}/${s.maxTeams} (${openSeats} left) | Status: ${s.status} | RegOpen: ${s.registrationOpen}`
    })

    const noticeLines = activeNotices.map(
      (n) => `- [${n.category}/${n.priority}] ${n.title}: ${n.content.slice(0, 180)}`
    )

    const resultLines = recentResults.map(
      (r) => `- ${r.matchDate}: #${r.placement} ${r.winningTeam} (${r.kills} kills, Prize ৳${r.prizeBdt}, ${r.category})`
    )

    const tutorialLines = recentTutorials.map(
      (t) => `- ${t.title}${t.description ? `: ${t.description.slice(0, 120)}` : ""}`
    )

    const payoutNames = payoutList.map((p) => p.name).join(", ") || "bKash, Nagad, Rocket, Balance"

    return [
      `Platform: ACE SCRIMS (www.acescrims.online) — Mobile-only Free Fire esports scrims platform in Bangladesh.`,
      `Bangladesh Active Date: ${activeDate}`,
      `Maintenance Mode: ${siteSettings?.maintenanceMode ? "ENABLED" : "OFF"}`,
      `Active Prize Payout Methods: ${payoutNames}`,
      `Public Community Links: Discord=${siteSettings?.discordUrl || "N/A"}, Facebook=${siteSettings?.facebookUrl || "N/A"}, WhatsApp Support=${siteSettings?.supportWhatsapp || "N/A"}, WhatsApp Channel=${siteSettings?.whatsappChannelUrl || "N/A"}`,
      `Standard Rules: Mobile players only (no emulators, no hacks/teaming). Room ID & Password appear in the player Dashboard 10-15 minutes before match start. Prizes are distributed within 6 hours (max 24h) after official results are published. Players can register in multiple scrims simultaneously.`,
      `\nActive Scrims Schedule Today (${activeScrims.length} lobbies):`,
      scrimLines.length > 0 ? scrimLines.join("\n") : "- No active scrims listed right now.",
      `\nPublished Notices:`,
      noticeLines.length > 0 ? noticeLines.join("\n") : "- No active notices.",
      `\nLatest Published Results:`,
      resultLines.length > 0 ? resultLines.join("\n") : "- No recent results.",
      `\nTutorials Available (/tutorials):`,
      tutorialLines.length > 0 ? tutorialLines.join("\n") : "- Tutorials page has guides on booking and gameplay.",
    ].join("\n")
  } catch (err) {
    console.warn("[AI Support] Failed building public context:", err)
    return "Platform: ACE SCRIMS (www.acescrims.online) — Free Fire competitive scrims platform in Bangladesh."
  }
}

export async function generateAiSupportReply(params: {
  message: string
  history: Array<{ senderRole: string; senderName: string; message: string }>
  userName?: string
}): Promise<{ ok: boolean; reply?: string; unavailable?: boolean }> {
  const ai = getGeminiClient()
  if (!ai) {
    return { ok: false, unavailable: true }
  }

  try {
    const context = await buildPublicPlatformContext()
    const recentHistory = params.history
      .slice(-10)
      .map((h) => `${h.senderRole === "user" ? params.userName || "Player" : h.senderName}: ${h.message}`)
      .join("\n")

    const response = await generateWithRetry(ai, {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are ACE AI Support, the official virtual assistant for ACE SCRIMS (www.acescrims.online), a competitive Free Fire esports scrims platform in Bangladesh.

STRICT PRIVACY & ACCURACY RULES:
1. ONLY use the PUBLIC platform information below or general platform navigation guidance (/scrims, /results, /notices, /tutorials, /report, /dashboard, /dashboard/wallet, /dashboard/info-setup).
2. NEVER invent Room IDs, Room Passwords, private user details, payment transaction outcomes, or refund confirmations. If a user asks about a personal payment issue, missing slot after payment, hacker report, or account-specific issue, tell them clearly to tap "Talk to Human Agent" in the chat header or submit a ticket on /report.
3. Reply in the SAME language the player wrote in (English, Bengali বাংলা, or Banglish). Keep answers concise, clear, friendly, and formatted neatly for a chat bubble (under 140 words unless listing scrims).

PUBLIC PLATFORM CONTEXT:
${context}

RECENT CONVERSATION:
${recentHistory || "(New conversation)"}

PLAYER'S NEW MESSAGE:
${params.message}`,
            },
          ],
        },
      ],
    })

    const reply = response.text?.trim()
    if (!reply) {
      return { ok: false, unavailable: true }
    }
    return { ok: true, reply }
  } catch (err) {
    console.warn("[AI Support] Gemini reply generation error:", err)
    return { ok: false, unavailable: true }
  }
}
