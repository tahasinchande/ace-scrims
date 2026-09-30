import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import os from "os"

export const dynamic = "force-dynamic"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params
    const pathSegments = resolvedParams?.path
    if (!pathSegments || pathSegments.length === 0) {
      return new NextResponse("Not Found", { status: 404 })
    }

    // Sanitize path against directory traversal
    const safeSubPath = path.normalize(pathSegments.join("/")).replace(/^(\.\.[\/\\])+/, "")
    // Check multiple candidate locations:
    const candidatePaths = [
      path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "uploads", safeSubPath),
      path.join(/*turbopackIgnore: true*/ process.cwd(), "uploads", safeSubPath),
      path.join(os.tmpdir(), "uploads", safeSubPath),
      path.join(os.tmpdir(), safeSubPath),
      path.join(/*turbopackIgnore: true*/ process.cwd(), "public", safeSubPath),
    ]

    let filePath: string | null = null
    for (const p of candidatePaths) {
      if (fs.existsSync(p) && !fs.statSync(p).isDirectory()) {
        filePath = p
        break
      }
    }

    if (!filePath) {
      // Graceful fallback for files uploaded in prior ephemeral containers or sample media
      const fallbackPath = path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "images", "scrim-1.jpg")
      if (fs.existsSync(fallbackPath)) {
        const fallbackBuffer = await fs.promises.readFile(fallbackPath)
        return new NextResponse(fallbackBuffer, {
          status: 200,
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "public, max-age=3600",
          },
        })
      }
      return new NextResponse("File Not Found", { status: 404 })
    }

    const fileBuffer = await fs.promises.readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()

    let contentType = "application/octet-stream"
    if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg"
    else if (ext === ".png") contentType = "image/png"
    else if (ext === ".gif") contentType = "image/gif"
    else if (ext === ".webp") contentType = "image/webp"
    else if (ext === ".svg") contentType = "image/svg+xml"
    else if (ext === ".mp4") contentType = "video/mp4"
    else if (ext === ".webm") contentType = "video/webm"
    else if (ext === ".pdf") contentType = "application/pdf"

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch (err) {
    console.error("[Upload Route] Error serving file:", err)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
