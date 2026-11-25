import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"
import { isStaffRole } from "@/lib/roles"

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

        const isStaff = isStaffRole(user.role)
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
          ],
          maximumSizeInBytes: isStaff ? 10 * 1024 * 1024 * 1024 : 100 * 1024 * 1024,
          tokenPayload: JSON.stringify({
            userId: user.id,
          }),
        }
      },
      onUploadCompleted: async () => {
        // Upload completion acknowledged silently
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
