import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import os from "os"

export const dynamic = "force-dynamic"

const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".pdf": "application/pdf",
}

const ATTACHMENT_EXTENSIONS = new Set([".svg", ".pdf"])

function isSafePathSegment(segment: string): boolean {
  if (!segment || segment === "." || segment === "..") return false
  if (segment.includes("\0") || segment.includes("/") || segment.includes("\\") || segment.includes("..")) {
    return false
  }
  return true
}

function resolveConfinedFile(baseDir: string, segments: string[]): string | null {
  const resolvedBase = path.resolve(baseDir)
  if (!fs.existsSync(resolvedBase)) return null

  const candidate = path.resolve(resolvedBase, ...segments)
  if (!candidate.startsWith(resolvedBase + path.sep)) {
    return null
  }

  if (!fs.existsSync(candidate)) return null

  // Resolve symlinks and re-verify strict confinement within the uploads root
  const realBase = fs.realpathSync(resolvedBase)
  const realCandidate = fs.realpathSync(candidate)
  if (!realCandidate.startsWith(realBase + path.sep)) {
    return null
  }

  const stat = fs.statSync(realCandidate)
  if (!stat.isFile()) return null

  return realCandidate
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params
    const pathSegments = resolvedParams?.path
    if (!pathSegments || pathSegments.length === 0) {
      return new NextResponse("Not Found", { status: 404 })
    }

    // Strictly validate every path segment to prevent directory traversal
    for (const rawSegment of pathSegments) {
      let decoded: string
      try {
        decoded = decodeURIComponent(rawSegment)
      } catch {
        return new NextResponse("Bad Request", { status: 400 })
      }
      if (!isSafePathSegment(rawSegment) || !isSafePathSegment(decoded)) {
        return new NextResponse("Bad Request", { status: 400 })
      }
    }

    // Restrict lookups strictly to dedicated uploads directories (never bare /tmp or arbitrary public/ files)
    const allowedRoots = [
      path.resolve(/*turbopackIgnore: true*/ process.cwd(), "public", "uploads"),
      path.resolve(/*turbopackIgnore: true*/ process.cwd(), "uploads"),
      path.resolve(os.tmpdir(), "uploads"),
    ]

    let filePath: string | null = null
    for (const root of allowedRoots) {
      const resolved = resolveConfinedFile(root, pathSegments)
      if (resolved) {
        filePath = resolved
        break
      }
    }

    if (!filePath) {
      return new NextResponse("File Not Found", {
        status: 404,
        headers: { "X-Content-Type-Options": "nosniff" },
      })
    }

    const fileBuffer = await fs.promises.readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const contentType = MIME_MAP[ext] ?? "application/octet-stream"

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable",
    }

    // Prevent active/scriptable content (e.g., SVG or unknown binary) from executing in origin context
    if (ATTACHMENT_EXTENSIONS.has(ext) || !MIME_MAP[ext]) {
      const safeDownloadName = path.basename(filePath).replace(/[^a-zA-Z0-9._-]/g, "_")
      headers["Content-Security-Policy"] = "default-src 'none'; sandbox"
      headers["Content-Disposition"] = `attachment; filename="${safeDownloadName}"`
    }

    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    })
  } catch (err) {
    console.error("[Upload Route] Error serving file:", err)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
