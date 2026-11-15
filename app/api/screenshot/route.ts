import { NextResponse, type NextRequest } from "next/server"

/**
 * Streams result screenshots from the private Blob store.
 * Only URLs pointing at our own private store are allowed, so this
 * cannot be abused as an open proxy.
 */
export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get("url")
  if (!src) return new NextResponse("Missing url", { status: 400 })

  let parsed: URL
  try {
    parsed = new URL(src)
  } catch {
    return new NextResponse("Invalid url", { status: 400 })
  }

  // Restrict to HTTPS and our own blob store host.
  if (
    parsed.protocol !== "https:" ||
    (!parsed.hostname.endsWith(".blob.vercel-storage.com") &&
      !parsed.hostname.endsWith(".vercel-storage.com"))
  ) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN
  const headers: Record<string, string> = {}
  if (token) {
    headers["authorization"] = `Bearer ${token}`
  }

  const upstream = await fetch(parsed.toString(), {
    headers,
    redirect: "error",
  }).catch(() => null)
  if (!upstream || !upstream.ok || !upstream.body) {
    return new NextResponse("Not found", { status: 404 })
  }

  const contentType = upstream.headers.get("content-type") || "image/jpeg"

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}
