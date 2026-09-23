import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getCloudinaryCloudName(): string | null {
  if (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) {
    return process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME.trim()
  }
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    return process.env.CLOUDINARY_CLOUD_NAME.trim()
  }
  if (process.env.CLOUDINARY_URL) {
    try {
      const urlStr = process.env.CLOUDINARY_URL.trim()
      // e.g. cloudinary://api_key:api_secret@cloud_name
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

function getCloudinaryPreset(): string {
  return (
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim() ||
    process.env.CLOUDINARY_UPLOAD_PRESET?.trim() ||
    "ml_default"
  )
}

export async function GET() {
  const cloudName = getCloudinaryCloudName()
  const uploadPreset = getCloudinaryPreset()

  return NextResponse.json({
    ok: true,
    cloudName,
    uploadPreset,
    configured: Boolean(cloudName),
  })
}
