"use client"

import { ScrollText } from "lucide-react"
import { useLanguage } from "@/lib/language"
import { cn } from "@/lib/utils"

export function translateRuleText(rule: string, isBn: boolean): string {
  const clean = rule.replace(/^\d+\.\s*/, "").trim()
  if (!isBn) return clean

  const lower = clean.toLowerCase()
  if (lower.includes("3 matches") && (lower.includes("bermuda") || lower.includes("purgatory"))) {
    return "৩টি ম্যাচ (বারমুডা, পারগেটরি ও কালাহারি)।"
  }
  if (lower.includes("5 matches") && (lower.includes("bermuda") || lower.includes("solana") || lower.includes("nexterra"))) {
    return "৫টি ম্যাচ (বারমুডা, পারগেটরি, কালাহারি, সোলানা ও নেক্সটেরা)।"
  }
  if (lower.includes("battle royale squad mode") || lower.includes("12 teams")) {
    return "ব্যাটল রয়্যাল স্কোয়াড মোড (১২টি টিম)।"
  }
  if (lower.includes("no emulators") || lower.includes("emulators are strictly prohibited") || lower.includes("emulator")) {
    return "কোনো প্রকার এমুলেটর প্লেয়ার অনুমোদিত নয় (শুধুমাত্র মোবাইল প্লেয়ার)।"
  }
  if (lower.includes("join room") && lower.includes("prior to match start")) {
    return "ম্যাচ শুরু হওয়ার ১০-১৫ মিনিট পূর্বে কাস্টম রুমে প্রবেশ করুন।"
  }
  if (lower.includes("join room on time")) {
    return "নির্দিষ্ট সময়ে কাস্টম রুমে প্রবেশ করুন। এমুলেটর সম্পূর্ণ নিষিদ্ধ।"
  }
  if (lower.includes("hacker report") || lower.includes("report hacker")) {
    return "হ্যাকার রিপোর্ট করতে চাইলে ম্যাচ শেষ হওয়ার ১ ঘণ্টার মধ্যে ভিডিও প্রমাণসহ জমা দিতে হবে।"
  }
  if (lower.includes("teaming") || lower.includes("collusion")) {
    return "কোনো ধরণের টিমিং বা অনৈতিক সহায়তা সম্পূর্ণ নিষিদ্ধ। ধরা পড়লে আজীবনের জন্য ব্যান।"
  }
  if (lower.includes("gun attribute") || lower.includes("gun skins")) {
    return "গান প্রপার্টি/অ্যাট্রিবিউটস ডিফল্ট কম্পিটিটিভ সেটিংসে নির্ধারিত থাকবে।"
  }
  if (lower.includes("character skill") || lower.includes("active skill")) {
    return "ক্যারেক্টার স্কিল অনুমোদিত।"
  }
  if (lower.includes("room id") && (lower.includes("share") || lower.includes("sharing"))) {
    return "রুম আইডি ও পাসওয়ার্ড অন্য কারো সাথে শেয়ার করা সম্পূর্ণ নিষেধ।"
  }
  if (lower.includes("prize") && (lower.includes("6 hour") || lower.includes("payout") || lower.includes("bKash"))) {
    return "ম্যাচের ফলাফল প্রকাশের ৬ ঘণ্টার মধ্যে ক্যাপ্টেনের বিকাশ/নগদে প্রাইজ মানি পাঠানো হবে।"
  }
  if (lower.includes("5.00 bdt fee") || lower.includes("transfer charges")) {
    return "লক্ষ্য রাখবেন ক্যাশআউট চার্জ বাবদ প্রাইজ মানি থেকে ৫.০০ টাকা ফি কর্তন করা হবে।"
  }
  if (lower.includes("maximum 8 matches will occur")) {
    return "ব্যাটল রয়্যাল ফরম্যাট — সর্বোচ্চ ৮টি ম্যাচ অনুষ্ঠিত হবে।"
  }
  if (lower.includes("80 points unlock") || lower.includes("80 points can unlock")) {
    return "৮০ পয়েন্ট আনলক: যে দল ৮০ পয়েন্ট অর্জন করবে তারা চ্যাম্পিয়ন রাশ ফরম্যাট আনলক করবে।"
  }
  if (lower.includes("champion decider") || lower.includes("gets a booyah, the scrim will finish")) {
    return "চ্যাম্পিয়ন নির্ধারণ: চ্যাম্পিয়ন রাশ আনলক হওয়ার পর আনলকড দলের যেকোনো একটি যদি বুইয়া (Booyah) পায়, টুর্নামেন্ট সেখানেই শেষ হবে এবং সেই দল চ্যাম্পিয়ন হবে।"
  }
  if (lower.includes("without a booyah by an unlocked team")) {
    return "যদি ৮টি ম্যাচ শেষ হওয়ার পরেও কোনো আনলকড দল বুইয়া না পায়, তবে সর্বোচ্চ পয়েন্টধারী দল চ্যাম্পিয়ন ঘোষিত হবে।"
  }
  return clean
}

export function ScrimRules({
  scrim,
  className,
}: {
  scrim: {
    title: string
    slug?: string
    rules?: string | null
  }
  className?: string
}) {
  const { lang, t } = useLanguage()
  const isBn = lang === "bn"

  const isChampionRush =
    scrim.title.trim().toLowerCase() === "10 pm champion rush" ||
    scrim.title.toLowerCase().includes("champion rush") ||
    scrim.slug?.toLowerCase().includes("champion-rush")

  const isFridaySpecial =
    scrim.title.toLowerCase().includes("friday special") ||
    scrim.slug?.toLowerCase().includes("friday-special")

  const HACKER_REPORT_RULE =
    "If you want to submit a hacker report, you have to submit it within 1 hour after the match gets completed."
  const PRIZE_FEE_RULE =
    "Please note that a 5.00 BDT fee will be deducted from the final prize payout to cover transfer charges."

  // Clean base rules and strip any existing variations of the mandatory rules to prevent duplicates
  const baseRules = (scrim.rules ?? "")
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean)
    .filter(
      (r) =>
        !r.toLowerCase().includes("hacker report") &&
        !r.toLowerCase().includes("5.00 bdt fee") &&
        !r.toLowerCase().includes("final prize payout")
    )

  // Globally append both rules to every scrim rules section
  const displayRules = [
    ...baseRules,
    HACKER_REPORT_RULE,
    PRIZE_FEE_RULE,
  ]

  if (displayRules.length === 0) return null

  return (
    <section aria-labelledby="rules-heading" className={cn("glass rounded-2xl p-6", className)}>
      <h2
        id="rules-heading"
        className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide"
      >
        <ScrollText className="size-5 text-primary" aria-hidden />
        {t("rules_heading", "Rules & Format")}
      </h2>

      {!isChampionRush && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3.5 text-sm font-semibold text-primary">
          <span className="flex size-2 rounded-full bg-primary" aria-hidden />
          <span>
            {isBn
              ? isFridaySpecial
                ? "৫টি ম্যাচ (বারমুডা, পারগেটরি, কালাহারি, সোলানা ও নেক্সটেরা)"
                : "৩টি ম্যাচ (বারমুডা, পারগেটরি ও কালাহারি)"
              : isFridaySpecial
              ? "5 Matches (Bermuda, Purgatory, Kalahari, Solana, and Nexterra)"
              : "3 Matches (BERMUDA, PURGATORY & KALAHARI)"}
          </span>
        </div>
      )}

      <ul className={cn("flex flex-col gap-2.5", !isChampionRush ? "mt-3" : "mt-4")}>
        {displayRules.map((rule, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
            <span>{translateRuleText(rule, isBn)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
