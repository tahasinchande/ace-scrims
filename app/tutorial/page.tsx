import type { Metadata } from "next"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { getSessionUser } from "@/lib/session"
import { db } from "@/lib/db"
import { tutorials } from "@/lib/db/schema"
import { desc } from "drizzle-orm"
import { TutorialView } from "@/components/tutorial/tutorial-view"
import { getPublicSiteSettings } from "@/lib/queries/settings"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Tutorial — How to Join Free Fire Scrims | RushX Organization",
  description: "Step-by-step tutorial and video guides on how to register your squad, make instant payments via automated gateway, receive room ID/pass on WhatsApp, and claim prizes.",
}

export default async function TutorialPage() {
  const [user, videoTutorials, settings] = await Promise.all([
    getSessionUser().catch(() => null),
    db.select().from(tutorials).orderBy(desc(tutorials.createdAt)).catch(() => []),
    getPublicSiteSettings().catch(() => undefined),
  ])

  return (
    <>
      <SiteHeader user={user ? { name: user.name, role: user.role } : null} settings={settings} />
      <main className="min-h-screen py-16">
        <TutorialView tutorials={videoTutorials} />
      </main>
      <SiteFooter settings={settings} />
    </>
  )
}
