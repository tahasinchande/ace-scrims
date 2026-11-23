import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { getAllNotices } from "@/lib/queries/notices"
import { NoticesFeed } from "@/components/dashboard/notices-feed"
import { Megaphone } from "lucide-react"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Notices & Announcements — RushX Organization",
  description: "Official updates, tournament schedules, rules, and notices from RushX Organization Administration.",
}

export default async function DashboardNoticesPage() {
  const user = await getSessionUser()
  if (!user) redirect("/sign-in?next=/dashboard/notices")

  const notices = await getAllNotices(true)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-primary">
          <Megaphone className="size-5" />
          <span className="text-xs font-bold uppercase tracking-wider">Official Bulletin</span>
        </div>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-foreground sm:text-3xl">
          Notices & Announcements
        </h1>
        <p className="text-sm text-muted-foreground">
          Stay informed with official announcements, tournament rules, schedule adjustments, and platform updates.
        </p>
      </div>

      <NoticesFeed initialNotices={notices} />
    </div>
  )
}
