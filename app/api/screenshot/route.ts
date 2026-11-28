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

  // Restrict strictly to HTTPS, no embedded credentials/custom ports, and our own Vercel Blob store host.
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() || ""
  const tokenStoreMatch = token.match(/^vercel_blob_rw_([a-z0-9]+)_/i)
  const allowedStoreId = tokenStoreMatch?.[1]?.toLowerCase() || null
  const host = parsed.hostname.toLowerCase()

  const isVercelBlobHost =
    host.endsWith(".blob.vercel-storage.com") || host.endsWith(".vercel-storage.com")
  const matchesOwnStore =
    !allowedStoreId ||
    host === `${allowedStoreId}.public.blob.vercel-storage.com` ||
    host === `${allowedStoreId}.private.blob.vercel-storage.com` ||
    host.startsWith(`${allowedStoreId}.`)

  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    !isVercelBlobHost ||
    !matchesOwnStore
  ) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const headers: Record<string, string> = {}
  if (token && allowedStoreId && matchesOwnStore) {
    headers["authorization"] = `Bearer ${token}`
  }

  const upstream = await fetch(parsed.toString(), {
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  }).catch(() => null)
  if (!upstream || !upstream.ok || !upstream.body) {
    return new NextResponse("Not found", { status: 404 })
  }

  const contentType = (upstream.headers.get("content-type") || "image/jpeg").toLowerCase()
  if (!contentType.startsWith("image/") || contentType.includes("svg")) {
    return new NextResponse("Unsupported media type", { status: 415 })
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}
