import { requireAdmin } from "@/lib/session"
import { db } from "@/lib/db"
import { tutorials } from "@/lib/db/schema"
import { desc } from "drizzle-orm"
import { AdminTutorials } from "@/components/admin/admin-tutorials"

export const dynamic = "force-dynamic"

export default async function AdminTutorialsPage() {
  await requireAdmin()

  const list = await db
    .select()
    .from(tutorials)
    .orderBy(desc(tutorials.createdAt))
    .catch(() => [])

  return (
    <div className="space-y-6">
      <AdminTutorials tutorials={list} />
    </div>
  )
}
