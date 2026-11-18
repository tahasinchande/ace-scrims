import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"

const PROTECTED_PREFIXES = ["tutorials/", "scrims/", "banners/", "results/", "email-media/", "notices/"]

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as HandleUploadBody

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const user = await getSessionUser().catch(() => null)
        if (!user || user.banned) {
          throw new Error("Authentication required for uploads.")
        }

        const isStaff = user.role === "admin" || user.role === "moderator"
        const normalizedPath = pathname.replace(/^\/+/, "")
        if (normalizedPath.includes("..")) {
          throw new Error("Invalid upload path.")
        }
        if (
          PROTECTED_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix)) &&
          !isStaff
        ) {
          throw new Error("Staff privileges required for this upload folder.")
        }

        return {
          allowedContentTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "video/mp4",
            "video/webm",
            "video/quicktime",
            "video/x-matroska",
            "video/x-msvideo",
            "application/pdf",
          ],
          maximumSizeInBytes: isStaff
            ? 10 * 1024 * 1024 * 1024 // Up to 10GB for staff tutorial videos
            : 100 * 1024 * 1024, // Up to 100MB for player chat/report uploads
          tokenPayload: JSON.stringify({
            userId: user.id,
            userRole: user.role ?? "user",
            pathname: normalizedPath,
          }),
        }
      },
      onUploadCompleted: async () => {
        // Upload completion webhook acknowledged silently
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload authorization failed"
    const status = message.includes("Authentication")
      ? 401
      : message.includes("Staff privileges")
        ? 403
        : 400
    return NextResponse.json({ error: message }, { status })
  }
}
