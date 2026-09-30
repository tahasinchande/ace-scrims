import { NextResponse } from "next/server"
import { getPublicSiteSettings } from "@/lib/queries/settings"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const settings = await getPublicSiteSettings()
    return NextResponse.json(settings, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    })
  } catch (error) {
    console.error("Error fetching site settings API:", error)
    return NextResponse.json(
      {
        supportWhatsapp: "+8801831510108",
        discordUrl: "https://discord.gg/aKF4hMuhmA",
        facebookUrl: "https://facebook.com/acescrims",
      },
      { status: 500 }
    )
  }
}
