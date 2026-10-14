import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"
import { saveUploadedFile } from "@/lib/upload"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser().catch(() => null)

    let formData: FormData
    try {
      formData = await req.formData()
    } catch (parseErr: any) {
      console.error("[API Upload] Failed to parse formData:", parseErr)
      return NextResponse.json(
        { ok: false, error: "Failed to parse form data. Payload may be too large or malformed." },
        { status: 400 }
      )
    }

    const file = formData.get("file")
    const folder = (formData.get("folder") as string) || "uploads"

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "No file provided in form-data" }, { status: 400 })
    }

    if (file.size === 0) {
      return NextResponse.json({ ok: false, error: "File is empty (0 bytes)" }, { status: 400 })
    }

    // Size limit check (supports images and videos up to 100MB)
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "File size exceeds 100MB limit" }, { status: 413 })
    }

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Authentication required to upload files." },
        { status: 401 }
      )
    }

    // Role validation for protected folders
    const isStaff =
      user.role === "admin" ||
      user.role === "moderator" ||
      user.role === "staff" ||
      user.role === "mod"

    const protectedFolders = ["tutorials", "scrims", "banners", "results"]
    if (protectedFolders.includes(folder) && !isStaff) {
      return NextResponse.json(
        { ok: false, error: `Admin or staff privileges required for ${folder} uploads` },
        { status: 403 }
      )
    }

    const url = await saveUploadedFile(file, folder)
    const isImage = file.type.startsWith("image/")

    return NextResponse.json({
      ok: true,
      url,
      fileName: file.name,
      fileSize: file.size,
      fileType: isImage ? "image" : "video",
    })
  } catch (err: any) {
    console.error("[API Upload] Unhandled error saving file:", err)
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "File upload failed due to internal server error",
      },
      { status: 500 }
    )
  }
}
