import { v2 as cloudinary, type UploadApiResponse } from "cloudinary"
import { randomUUID } from "crypto"

// Initialize Cloudinary SDK
if (process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloudinary_url: process.env.CLOUDINARY_URL,
    secure: true,
  })
} else if (process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  })
}

/**
 * Uploads a Buffer directly to Cloudinary using v2.uploader.upload_stream
 * Completely bypasses any filesystem operations or temp folder writes.
 * Protected with a strict 10s promise timeout to prevent serverless function hangs.
 */
export async function uploadStreamToCloudinary(
  buffer: Buffer,
  folder: string,
  fileName?: string
): Promise<string | null> {
  const cloudName =
    process.env.CLOUDINARY_CLOUD_NAME ||
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    (process.env.CLOUDINARY_URL ? "configured" : null)

  if (!cloudName) {
    console.warn("[Cloudinary] No cloud_name or CLOUDINARY_URL found in environment variables.")
    return null
  }

  return new Promise<string | null>((resolve) => {
    let isSettled = false

    // Safety timeout: Never let serverless function hang indefinitely
    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true
        console.warn("[Cloudinary SDK] Upload stream timed out after 10 seconds. Falling back.")
        resolve(null)
      }
    }, 10000)

    try {
      const publicId = fileName
        ? `${folder}_${Date.now()}_${fileName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_")}`
        : `${folder}_${Date.now()}_${randomUUID().slice(0, 8)}`

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `acescrims/${folder}`,
          resource_type: "auto",
          public_id: publicId,
          overwrite: true,
          invalidate: true,
        },
        (error: Error | undefined, result: UploadApiResponse | undefined) => {
          if (isSettled) return
          isSettled = true
          clearTimeout(timer)

          if (error) {
            console.error("[Cloudinary SDK] Upload stream error callback:", error.message || error)
            resolve(null)
            return
          }

          if (result?.secure_url) {
            resolve(result.secure_url)
            return
          }
          if (result?.url) {
            resolve(result.url)
            return
          }
          resolve(null)
        }
      )

      uploadStream.on("error", (streamErr: any) => {
        if (isSettled) return
        isSettled = true
        clearTimeout(timer)
        console.error("[Cloudinary SDK] Stream event error:", streamErr?.message || streamErr)
        resolve(null)
      })

      // Pipe the entire buffer into the upload stream
      uploadStream.end(buffer)
    } catch (err: any) {
      if (isSettled) return
      isSettled = true
      clearTimeout(timer)
      console.error("[Cloudinary SDK] Unexpected upload stream failure:", err?.message || err)
      resolve(null)
    }
  })
}

/**
 * Saves an uploaded file directly into cloud storage (Cloudinary)
 * or in-memory Base64 Data URI without touching the local disk.
 */
export async function saveUploadedFile(file: File, folder: string): Promise<string> {
  if (!file || !(file instanceof File) || file.size === 0) {
    throw new Error("Invalid or empty file uploaded.")
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // 1. Primary: Cloudinary Node SDK upload_stream
  try {
    const cloudinaryUrl = await uploadStreamToCloudinary(buffer, folder, file.name)
    if (cloudinaryUrl) {
      return cloudinaryUrl
    }
  } catch (cErr) {
    console.warn("[Upload] Cloudinary upload_stream attempt failed:", cErr)
  }

  // 2. Secondary: Cloudinary unsigned REST upload fallback
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
  if (cloudName && uploadPreset) {
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("upload_preset", uploadPreset)
      formData.append("folder", `acescrims/${folder}`)

      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
        method: "POST",
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        if (data.secure_url) return data.secure_url
        if (data.url) return data.url
      }
    } catch (presetErr) {
      console.warn("[Upload] Cloudinary unsigned REST upload failed:", presetErr)
    }
  }

  // 3. Guaranteed In-memory Base64 Data URI fallback:
  // 100% reliable on read-only serverless environments without any local filesystem access.
  const mimeType = file.type || "image/png"
  const base64 = buffer.toString("base64")
  return `data:${mimeType};base64,${base64}`
}
