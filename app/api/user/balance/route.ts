import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"
import { db } from "@/lib/db"
import { user } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const sessionUser = await getSessionUser()
    if (!sessionUser) {
      return NextResponse.json({ ok: false, balance: 0 }, { status: 401 })
    }
    const row = await db.select({ balance: user.balance }).from(user).where(eq(user.id, sessionUser.id)).limit(1)
    return NextResponse.json({ ok: true, balance: row[0]?.balance ?? 0 })
  } catch (err: any) {
    return NextResponse.json({ ok: false, balance: 0, error: err?.message }, { status: 500 })
  }
}
