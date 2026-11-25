import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"
import { saveUploadedFile } from "@/lib/upload"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const ALLOWED_FOLDERS = new Set([
  "uploads",
  "reports",
  "avatars",
  "chat",
  "tutorials",
  "scrims",
  "banners",
  "results",
  "email-media",
  "notices",
])

const PROTECTED_FOLDERS = new Set(["tutorials", "scrims", "banners", "results", "email-media", "notices"])

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
  "video/x-msvideo",
  "application/pdf",
])

const ALLOWED_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "mp4",
  "webm",
  "mov",
  "mkv",
  "avi",
  "pdf",
])

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser().catch(() => null)

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Authentication required to upload files." },
        { status: 401 }
      )
    }

    if (user.banned) {
      return NextResponse.json(
        { ok: false, error: "Account suspended. File uploads are disabled." },
        { status: 403 }
      )
    }

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
    const rawFolder = ((formData.get("folder") as string) || "uploads").trim().toLowerCase()
    const folder = ALLOWED_FOLDERS.has(rawFolder) ? rawFolder : "uploads"

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "No file provided in form-data" }, { status: 400 })
    }

    if (file.size === 0) {
      return NextResponse.json({ ok: false, error: "File is empty (0 bytes)" }, { status: 400 })
    }

    // Size limit check (Vercel serverless payload safeguard)
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "File size exceeds 100MB limit" }, { status: 413 })
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || ""
    const mime = (file.type || "").toLowerCase()
    if (mime === "image/svg+xml" || ext === "svg" || ext === "html" || ext === "htm" || ext === "js") {
      return NextResponse.json(
        { ok: false, error: "SVG and executable script/HTML uploads are blocked for security reasons." },
        { status: 400 }
      )
    }
    const isExtensionAllowed = ALLOWED_EXTENSIONS.has(ext)
    const isMimeAllowed = mime === "" || ALLOWED_MIME_TYPES.has(mime)
    if (!isExtensionAllowed || !isMimeAllowed) {
      return NextResponse.json(
        { ok: false, error: "Unsupported file type. Allowed: PNG, JPG, WEBP, GIF, MP4, WEBM, MOV, MKV, AVI, PDF." },
        { status: 400 }
      )
    }

    // Role validation for protected folders
    const isStaff =
      user.role === "owner" ||
      user.role === "admin" ||
      user.role === "moderator" ||
      user.role === "staff" ||
      user.role === "mod"

    if (PROTECTED_FOLDERS.has(folder) && !isStaff) {
      return NextResponse.json(
        { ok: false, error: `Admin or staff privileges required for ${folder} uploads` },
        { status: 403 }
      )
    }

    const url = await saveUploadedFile(file, folder)
    const isImage = mime.startsWith("image/")

    return NextResponse.json({
      ok: true,
      url,
      fileName: file.name,
      fileSize: file.size,
      fileType: isImage ? "image" : mime.startsWith("video/") ? "video" : "file",
    })
  } catch (err: any) {
    let errMsg = err?.message || "File upload failed due to internal server error"
    if (errMsg.toLowerCase().includes("cloudinary")) {
      errMsg = "File upload failed due to storage service error."
    }
    return NextResponse.json(
      {
        ok: false,
        error: errMsg,
      },
      { status: 500 }
    )
  }
}
