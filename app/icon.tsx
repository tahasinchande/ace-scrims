import { readFile } from "node:fs/promises"
import path from "node:path"

export const runtime = "nodejs"
export const size = {
  width: 64,
  height: 64,
}
export const contentType = "image/png"

export default async function Icon() {
  const iconPath = path.join(process.cwd(), "public", "images", "brand", "rushx-favicon-64.png")
  const buffer = await readFile(iconPath)
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}
