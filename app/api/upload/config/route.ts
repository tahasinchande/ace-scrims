import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function resolveMediaCloudName(): string | null {
  if (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) {
    return process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME.trim()
  }
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    return process.env.CLOUDINARY_CLOUD_NAME.trim()
  }
  if (process.env.CLOUDINARY_URL) {
    try {
      const urlStr = process.env.CLOUDINARY_URL.trim()
      if (urlStr.includes("@")) {
        const cloudPart = urlStr.split("@")[1]?.split("/")[0]?.split("?")[0]
        if (cloudPart) return cloudPart.trim()
      }
    } catch {
      // ignore
    }
  }
  return null
}

function resolveMediaPreset(): string {
  return (
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim() ||
    process.env.CLOUDINARY_UPLOAD_PRESET?.trim() ||
    "ml_default"
  )
}

export async function GET() {
  const user = await getSessionUser().catch(() => null)
  if (!user || user.banned) {
    return NextResponse.json(
      { ok: false, error: "Authentication required" },
      { status: 401 }
    )
  }

  const cloudName = resolveMediaCloudName()
  const uploadPreset = resolveMediaPreset()
  const blobEnabled = Boolean(process.env.BLOB_READ_WRITE_TOKEN)

  return NextResponse.json(
    {
      ok: true,
      cloudName,
      uploadPreset,
      blobEnabled,
      configured: Boolean(cloudName || blobEnabled),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  )
}
