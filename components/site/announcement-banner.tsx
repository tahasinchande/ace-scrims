import { db } from "@/lib/db"
import { settings } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { Megaphone } from "lucide-react"

export async function AnnouncementBanner() {
  let message: string | null = null
  try {
    const rows = await db.select().from(settings).where(eq(settings.key, "announcement")).limit(1)
    message = rows[0]?.value?.trim() || null
  } catch {
    message = null
  }
  if (!message) return null

  return (
    <div className="border-b border-primary/30 bg-primary/10 px-4 py-2.5 text-center">
      <p className="mx-auto flex max-w-4xl items-center justify-center gap-2 text-sm font-medium text-primary">
        <Megaphone className="size-4 shrink-0" aria-hidden />
        <span className="text-pretty">{message}</span>
      </p>
    </div>
  )
}
