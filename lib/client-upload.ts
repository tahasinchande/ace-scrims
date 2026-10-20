export type UploadProgressCallback = (percent: number) => void

export type UploadResult = {
  url: string
  fileName: string
  fileSize: number
}

// In-memory cache for Cloudinary client settings
let cachedConfig: { cloudName: string | null; uploadPreset: string } | null = null

/**
 * Dynamically resolves Cloudinary configuration.
 * Checks NEXT_PUBLIC_ client env first, and if unavailable, requests /api/upload/config
 * which reads CLOUDINARY_CLOUD_NAME, NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, or CLOUDINARY_URL from server env.
 */
export async function getCloudinaryConfig(): Promise<{ cloudName: string | null; uploadPreset: string }> {
  if (cachedConfig && cachedConfig.cloudName) {
    return cachedConfig
  }

  // 1. Check inlined client environment variables
  const envCloudName =
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    (typeof window !== "undefined" ? (window as any).__CLOUDINARY_CLOUD_NAME__ : null)

  const envPreset =
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ||
    (typeof window !== "undefined" ? (window as any).__CLOUDINARY_UPLOAD_PRESET__ : null) ||
    "ml_default"

  if (envCloudName && envCloudName.trim().length > 0) {
    cachedConfig = { cloudName: envCloudName.trim(), uploadPreset: envPreset }
    return cachedConfig
  }

  // 2. Fetch from server API endpoint to get server-configured Cloudinary parameters
  try {
    const res = await fetch("/api/upload/config", { cache: "no-store" })
    if (res.ok) {
      const data = await res.json()
      if (data.ok && data.cloudName) {
        cachedConfig = {
          cloudName: data.cloudName,
          uploadPreset: data.uploadPreset || "ml_default",
        }
        return cachedConfig
      }
    }
  } catch (fetchErr) {
    console.warn("[Upload Client] Failed to fetch upload config from server:", fetchErr)
  }

  return { cloudName: null, uploadPreset: envPreset }
}

/**
 * Direct Client-to-Cloudinary Video Upload.
 * 100% bypasses Vercel/Next.js API routes, preventing the 4.5MB Vercel 413 Payload Too Large error.
 * Streams directly from the user's browser to Cloudinary's Video REST endpoint with live progress.
 */
export async function uploadVideoToCloudinaryDirect(
  file: File,
  folder: string = "tutorials",
  onProgress?: UploadProgressCallback
): Promise<UploadResult> {
  if (!file || !(file instanceof File) || file.size === 0) {
    throw new Error("Please select a valid video file.")
  }

  if (file.size > 500 * 1024 * 1024) {
    throw new Error("Video file size must be under 500MB. Please compress the file or provide a direct video URL.")
  }

  const { cloudName, uploadPreset } = await getCloudinaryConfig()
  const targetFolder = folder ? `acescrims/${folder}` : "acescrims/tutorials"

  if (!cloudName) {
    throw new Error(
      "Cloud storage is not configured. Please ensure cloud storage environment variables are added, or paste an external video URL (YouTube/Drive/Vimeo) directly."
    )
  }

  onProgress?.(5)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`

    const formData = new FormData()
    formData.append("file", file)
    formData.append("upload_preset", uploadPreset)
    formData.append("folder", targetFolder)

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100)
        onProgress?.(Math.min(99, Math.max(5, percent)))
      }
    })

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText)
          const finalUrl = json.secure_url || json.url
          if (finalUrl) {
            onProgress?.(100)
            resolve({
              url: finalUrl,
              fileName: file.name,
              fileSize: file.size,
            })
            return
          }
          let rawMsg = json.error?.message || "Failed to receive a valid video URL from storage."
          if (rawMsg.toLowerCase().includes("cloudinary")) {
            rawMsg = "Cloud storage service error. Please try again or contact support."
          }
          reject(new Error(rawMsg))
        } catch {
          reject(new Error("Failed to parse upload response."))
        }
      } else {
        let errMsg = `Upload failed (HTTP ${xhr.status})`
        try {
          const json = JSON.parse(xhr.responseText)
          if (json.error?.message) {
            errMsg = json.error.message
            if (errMsg.toLowerCase().includes("upload preset must be whitelisted for unsigned uploads")) {
              errMsg = "Upload configuration error: The upload preset must be set to 'Unsigned' in your cloud storage settings."
            }
          }
        } catch {
          // ignore parsing error
        }
        if (errMsg.toLowerCase().includes("cloudinary")) {
          errMsg = "Upload failed due to storage provider error. Please try again."
        }
        console.error("[Video Upload HTTP Error]", {
          status: xhr.status,
        })
        reject(new Error(errMsg))
      }
    })

    xhr.addEventListener("error", () => {
      console.error("[Video Upload Network Error]")
      reject(
        new Error(
          "Network connection failed during upload. Please check your internet connection or try a smaller video."
        )
      )
    })

    xhr.addEventListener("timeout", () => {
      reject(new Error("Video upload timed out. Please check your internet connection."))
    })

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload cancelled."))
    })

    // Allow generous 10-minute timeout for large video files
    xhr.timeout = 10 * 60 * 1000

    xhr.open("POST", endpoint)
    xhr.send(formData)
  })
}

/**
 * Universal media upload helper.
 * Automatically routes videos directly to Cloudinary REST endpoint to bypass Vercel 4.5MB payload limits.
 * For images, uploads via client or server stream.
 */
export async function uploadMediaFile(
  file: File,
  folder: "reports" | "tutorials" | "results" | "scrims" | "banners" | "chat" | "avatars" | "uploads" = "uploads",
  onProgress?: UploadProgressCallback
): Promise<UploadResult> {
  if (!file || !(file instanceof File) || file.size === 0) {
    throw new Error("Please select a valid non-empty file to upload.")
  }

  const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|webm|mkv|avi)$/i.test(file.name)

  // 1. VIDEOS: Always use Direct Client-to-Cloudinary upload to bypass Vercel 4.5MB limit
  if (isVideo) {
    return uploadVideoToCloudinaryDirect(file, folder, onProgress)
  }

  // 2. IMAGES: Pre-upload client-side validation
  if (file.size > 30 * 1024 * 1024) {
    throw new Error("Image file size must be under 30MB.")
  }

  onProgress?.(15)

  // Direct Cloudinary client-side upload if cloud name is available
  const { cloudName, uploadPreset } = await getCloudinaryConfig()

  if (cloudName && uploadPreset) {
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("upload_preset", uploadPreset)
      form.append("folder", `acescrims/${folder}`)

      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
        method: "POST",
        body: form,
      })

      if (res.ok) {
        const json = await res.json()
        const directUrl = json.secure_url || json.url
        if (directUrl) {
          onProgress?.(100)
          return {
            url: directUrl,
            fileName: file.name,
            fileSize: file.size,
          }
        }
      }
    } catch (clientErr) {
      console.warn("[Upload Client] Direct image upload skipped, falling back to /api/upload:", clientErr)
    }
  }

  // Server API upload via /api/upload (which streams directly to Cloudinary or base64)
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()
    formData.append("file", file)
    formData.append("folder", folder)

    xhr.timeout = 35000

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100)
        onProgress?.(Math.min(99, Math.max(15, percent)))
      }
    })

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText)
          if (json.ok && json.url) {
            onProgress?.(100)
            resolve({
              url: json.url,
              fileName: json.fileName || file.name,
              fileSize: json.fileSize || file.size,
            })
            return
          }
          const errMsg = json.error || `Server responded with status ${xhr.status}`
          console.error("[Upload HTTP Error]", { status: xhr.status, response: xhr.responseText })
          reject(new Error(errMsg))
        } catch {
          console.error("[Upload Invalid Response]", { status: xhr.status, raw: xhr.responseText })
          reject(new Error(`Server returned status ${xhr.status} with non-JSON response.`))
        }
      } else {
        let errMsg = `Upload failed with HTTP ${xhr.status}`
        try {
          const json = JSON.parse(xhr.responseText)
          if (json.error) errMsg = json.error
        } catch {
          if (xhr.responseText) errMsg += `: ${xhr.responseText.slice(0, 100)}`
        }
        console.error("[Upload HTTP Error Response]", {
          status: xhr.status,
          statusText: xhr.statusText,
          response: xhr.responseText,
        })
        reject(new Error(errMsg))
      }
    })

    xhr.addEventListener("timeout", () => {
      console.error("[Upload Timeout]", { timeoutMs: xhr.timeout, file: file.name })
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === "string") {
          onProgress?.(100)
          resolve({
            url: reader.result,
            fileName: file.name,
            fileSize: file.size,
          })
        } else {
          reject(new Error("Upload request timed out after 35 seconds."))
        }
      }
      reader.onerror = () => reject(new Error("Upload request timed out."))
      reader.readAsDataURL(file)
    })

    xhr.addEventListener("error", () => {
      console.error("[Upload Network Error]", { status: xhr.status, file: file.name })
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === "string") {
          onProgress?.(100)
          resolve({
            url: reader.result,
            fileName: file.name,
            fileSize: file.size,
          })
        } else {
          reject(new Error("Network connection error during upload."))
        }
      }
      reader.onerror = () => reject(new Error("Network connection error."))
      reader.readAsDataURL(file)
    })

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload was cancelled."))
    })

    xhr.open("POST", "/api/upload")
    xhr.send(formData)
  })
}

/**
 * Uploads multiple files sequentially with overall progress reporting.
 */
export async function uploadMultipleMediaFiles(
  files: File[],
  folder: "reports" | "tutorials" | "results" | "scrims" | "banners" | "chat" | "avatars" | "uploads" = "uploads",
  onOverallProgress?: (percent: number, currentFileIdx: number, totalFiles: number) => void
): Promise<UploadResult[]> {
  const results: UploadResult[] = []
  const total = files.length
  if (total === 0) return results

  for (let i = 0; i < total; i++) {
    const file = files[i]
    const res = await uploadMediaFile(file, folder, (filePercent) => {
      const overall = Math.round(((i + filePercent / 100) / total) * 100)
      onOverallProgress?.(overall, i + 1, total)
    })
    results.push(res)
    onOverallProgress?.(Math.round(((i + 1) / total) * 100), i + 1, total)
  }

  return results
}
