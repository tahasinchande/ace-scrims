import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { tutorials } from "@/lib/db/schema"
import { getSessionUser } from "@/lib/session"
import { desc } from "drizzle-orm"
import { AdminTutorials } from "@/components/admin/admin-tutorials"

export const dynamic = "force-dynamic"
export const metadata = { title: "Tutorials — Admin — Ace Scrims" }

export default async function AdminTutorialsPage() {
  const user = await getSessionUser()
  if (!user) redirect("/sign-in")
  if (user.role !== "admin") redirect("/botsito/scrims")

  const rows = await db
    .select()
    .from(tutorials)
    .orderBy(desc(tutorials.createdAt))

  return <AdminTutorials tutorials={rows} />
}
