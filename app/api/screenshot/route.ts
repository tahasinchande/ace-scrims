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

  // Restrict to our own private blob store host.
  if (!parsed.hostname.endsWith(".private.blob.vercel-storage.com")) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) return new NextResponse("Storage not configured", { status: 500 })

  const upstream = await fetch(parsed.toString(), {
    headers: { authorization: `Bearer ${token}` },
  })
  if (!upstream.ok || !upstream.body) {
    return new NextResponse("Not found", { status: 404 })
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}
