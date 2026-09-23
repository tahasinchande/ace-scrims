import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const user = await getSessionUser().catch(() => null)
        // Allow public uploads for reports/chat or authenticated uploads for admins/staff
        return {
          allowedContentTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "image/svg+xml",
            "video/mp4",
            "video/webm",
            "video/quicktime",
            "video/x-matroska",
            "application/pdf",
          ],
          maximumSizeInBytes: 500 * 1024 * 1024, // Up to 500MB video/files
          tokenPayload: JSON.stringify({
            userId: user?.id ?? "guest",
            userRole: user?.role ?? "user",
            pathname,
          }),
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log("[Vercel Blob Client Upload Completed]", blob.url, tokenPayload)
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    )
  }
}
