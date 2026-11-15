import { upload as vercelBlobUpload } from "@vercel/blob/client"

export type UploadProgressCallback = (percent: number) => void

export type UploadResult = {
  url: string
  fileName: string
  fileSize: number
}

type StorageConfig = {
  mediaCloud: string | null
  mediaPreset: string
  blobEnabled: boolean
}

let cachedConfig: StorageConfig | null = null

const CHUNK_SIZE_BYTES = 20 * 1024 * 1024 // 20MB chunks for reliable multi-GB streaming
const CHUNK_THRESHOLD_BYTES = 24 * 1024 * 1024 // Use chunked upload above 24MB
const MAX_VIDEO_BYTES = 10 * 1024 * 1024 * 1024 // 10GB direct upload support (5GB+ ready)

async function resolveStorageConfig(): Promise<StorageConfig> {
  if (cachedConfig && (cachedConfig.mediaCloud || cachedConfig.blobEnabled)) {
    return cachedConfig
  }

  const envCloud =
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    (typeof window !== "undefined" ? (window as any).__MEDIA_CLOUD_NAME__ : null)

  const envPreset =
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ||
    (typeof window !== "undefined" ? (window as any).__MEDIA_UPLOAD_PRESET__ : null) ||
    "ml_default"

  try {
    const res = await fetch("/api/upload/config", { cache: "no-store" })
    if (res.ok) {
      const data = await res.json()
      if (data.ok) {
        cachedConfig = {
          mediaCloud: data.cloudName || (envCloud ? envCloud.trim() : null),
          mediaPreset: data.uploadPreset || envPreset,
          blobEnabled: Boolean(data.blobEnabled),
        }
        return cachedConfig
      }
    }
  } catch {
    // Fallback to client env if config endpoint fails
  }

  return {
    mediaCloud: envCloud ? envCloud.trim() : null,
    mediaPreset: envPreset,
    blobEnabled: false,
  }
}

function sanitizeUploadError(rawMessage: string): string {
  const lower = rawMessage.toLowerCase()
  if (lower.includes("cloudinary") || lower.includes("upload preset")) {
    if (lower.includes("unsigned")) {
      return "Media upload configuration needs attention. Please contact an administrator."
    }
    return "Media storage encountered an issue while processing your file. Please try again."
  }
  return rawMessage
}

function sendChunkWithRetry(
  endpoint: string,
  chunk: Blob,
  fileName: string,
  uploadPreset: string,
  folder: string,
  uniqueUploadId: string,
  startByte: number,
  endByte: number,
  totalBytes: number,
  onChunkProgress: (loadedInChunk: number) => void,
  attempt: number = 1
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()
    formData.append("file", chunk, fileName)
    formData.append("upload_preset", uploadPreset)
    formData.append("folder", folder)

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onChunkProgress(event.loaded)
      }
    })

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch {
          reject(new Error("Invalid response received from media storage."))
        }
      } else if ((xhr.status >= 500 || xhr.status === 429) && attempt < 3) {
        const delayMs = attempt * 1500
        setTimeout(() => {
          sendChunkWithRetry(
            endpoint,
            chunk,
            fileName,
            uploadPreset,
            folder,
            uniqueUploadId,
            startByte,
            endByte,
            totalBytes,
            onChunkProgress,
            attempt + 1
          )
            .then(resolve)
            .catch(reject)
        }, delayMs)
      } else {
        let errMsg = `Upload failed (HTTP ${xhr.status})`
        try {
          const json = JSON.parse(xhr.responseText)
          if (json.error?.message) {
            errMsg = sanitizeUploadError(json.error.message)
          }
        } catch {
          // ignore parse error
        }
        reject(new Error(errMsg))
      }
    })

    xhr.addEventListener("error", () => {
      if (attempt < 3) {
        const delayMs = attempt * 1500
        setTimeout(() => {
          sendChunkWithRetry(
            endpoint,
            chunk,
            fileName,
            uploadPreset,
            folder,
            uniqueUploadId,
            startByte,
            endByte,
            totalBytes,
            onChunkProgress,
            attempt + 1
          )
            .then(resolve)
            .catch(reject)
        }, delayMs)
      } else {
        reject(new Error("Network error while uploading video chunk. Please check your connection and try again."))
      }
    })

    xhr.addEventListener("timeout", () => {
      if (attempt < 3) {
        sendChunkWithRetry(
          endpoint,
          chunk,
          fileName,
          uploadPreset,
          folder,
          uniqueUploadId,
          startByte,
          endByte,
          totalBytes,
          onChunkProgress,
          attempt + 1
        )
          .then(resolve)
          .catch(reject)
      } else {
        reject(new Error("Upload chunk timed out. Please verify your internet connection."))
      }
    })

    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled.")))

    xhr.timeout = 10 * 60 * 1000 // 10 minutes per 20MB chunk
    xhr.open("POST", endpoint)
    xhr.setRequestHeader("X-Unique-Upload-Id", uniqueUploadId)
    xhr.setRequestHeader("Content-Range", `bytes ${startByte}-${endByte}/${totalBytes}`)
    xhr.send(formData)
  })
}

/**
 * Direct Chunked Multi-GB Video Upload (supports 5GB–10GB files cleanly).
 * Completely bypasses serverless API payload limits and timeouts by streaming chunks
 * directly from the browser to remote object storage.
 */
export async function uploadVideoDirect(
  file: File,
  folder: string = "tutorials",
  onProgress?: UploadProgressCallback
): Promise<UploadResult> {
  if (!file || !(file instanceof File) || file.size === 0) {
    throw new Error("Please select a valid video file.")
  }

  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error(
      "Video file size exceeds the 10GB direct upload limit. Please compress the video or paste an unlisted YouTube or Google Drive share link."
    )
  }

  const config = await resolveStorageConfig()
  const targetFolder = folder ? `acescrims/${folder}` : "acescrims/tutorials"

  // Path A: Vercel Blob multipart direct upload when Blob storage is enabled & primary
  if (config.blobEnabled && (!config.mediaCloud || file.size > 100 * 1024 * 1024)) {
    try {
      onProgress?.(2)
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const blob = await vercelBlobUpload(`${folder}/${Date.now()}-${safeName}`, file, {
        access: "public",
        handleUploadUrl: "/api/blob/upload",
        multipart: true,
        onUploadProgress: ({ percentage }) => {
          onProgress?.(Math.min(99, Math.max(2, Math.round(percentage))))
        },
      })
      onProgress?.(100)
      return {
        url: blob.url,
        fileName: file.name,
        fileSize: file.size,
      }
    } catch (blobErr) {
      if (!config.mediaCloud) {
        const msg = blobErr instanceof Error ? blobErr.message : "Video upload failed."
        throw new Error(sanitizeUploadError(msg))
      }
      // Fall through to chunked media cloud upload if configured
    }
  }

  if (!config.mediaCloud) {
    throw new Error(
      "Media storage is not configured. Please check storage environment variables or paste a YouTube or Google Drive video link."
    )
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${config.mediaCloud}/video/upload`

  onProgress?.(2)

  // Path B: Chunked resumable upload for files > 24MB (supports 5GB+ videos reliably)
  if (file.size > CHUNK_THRESHOLD_BYTES) {
    const uniqueUploadId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? `vid_${crypto.randomUUID()}`
        : `vid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

    let finalResponse: any = null
    for (let start = 0; start < file.size; start += CHUNK_SIZE_BYTES) {
      const endExclusive = Math.min(start + CHUNK_SIZE_BYTES, file.size)
      const endInclusive = endExclusive - 1
      const chunk = file.slice(start, endExclusive)

      finalResponse = await sendChunkWithRetry(
        endpoint,
        chunk,
        file.name,
        config.mediaPreset,
        targetFolder,
        uniqueUploadId,
        start,
        endInclusive,
        file.size,
        (loadedInChunk) => {
          const totalLoaded = start + Math.min(loadedInChunk, chunk.size)
          const pct = Math.round((totalLoaded / file.size) * 97) + 2
          onProgress?.(Math.min(99, Math.max(2, pct)))
        }
      )
    }

    const finalUrl = finalResponse?.secure_url || finalResponse?.url
    if (!finalUrl) {
      throw new Error("Upload completed but did not return a playable media link. Please try again.")
    }

    onProgress?.(100)
    return {
      url: finalUrl,
      fileName: file.name,
      fileSize: file.size,
    }
  }

  // Path C: Single direct upload for smaller videos (<= 24MB)
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()
    formData.append("file", file)
    formData.append("upload_preset", config.mediaPreset)
    formData.append("folder", targetFolder)

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100)
        onProgress?.(Math.min(99, Math.max(2, percent)))
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
          reject(new Error(sanitizeUploadError(json.error?.message || "Failed to finalize uploaded video.")))
        } catch {
          reject(new Error("Failed to parse upload response."))
        }
      } else {
        let errMsg = `Upload failed (HTTP ${xhr.status})`
        try {
          const json = JSON.parse(xhr.responseText)
          if (json.error?.message) {
            errMsg = sanitizeUploadError(json.error.message)
          }
        } catch {
          // ignore
        }
        reject(new Error(errMsg))
      }
    })

    xhr.addEventListener("error", () => {
      reject(new Error("Network connection failed during upload. Please try again."))
    })

    xhr.addEventListener("timeout", () => {
      reject(new Error("Video upload timed out. Please check your internet connection."))
    })

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload cancelled."))
    })

    xhr.timeout = 15 * 60 * 1000
    xhr.open("POST", endpoint)
    xhr.send(formData)
  })
}

// Backwards-compatible alias
export const uploadVideoToCloudinaryDirect = uploadVideoDirect

/**
 * Universal media upload helper.
 * Routes large videos directly via chunked/multipart upload to bypass serverless limits.
 * Uploads images/documents cleanly via configured media storage or /api/upload.
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

  if (isVideo) {
    return uploadVideoDirect(file, folder, onProgress)
  }

  if (file.size > 30 * 1024 * 1024) {
    throw new Error("File size must be under 30MB.")
  }

  onProgress?.(15)

  const config = await resolveStorageConfig()

  if (config.mediaCloud && config.mediaPreset) {
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("upload_preset", config.mediaPreset)
      form.append("folder", `acescrims/${folder}`)

      const res = await fetch(`https://api.cloudinary.com/v1_1/${config.mediaCloud}/auto/upload`, {
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
    } catch {
      // Silently fall back to /api/upload
    }
  }

  if (config.blobEnabled) {
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const blob = await vercelBlobUpload(`${folder}/${Date.now()}-${safeName}`, file, {
        access: "public",
        handleUploadUrl: "/api/blob/upload",
        onUploadProgress: ({ percentage }) => {
          onProgress?.(Math.min(99, Math.max(15, Math.round(percentage))))
        },
      })
      onProgress?.(100)
      return {
        url: blob.url,
        fileName: file.name,
        fileSize: file.size,
      }
    } catch {
      // Silently fall back to /api/upload
    }
  }

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
          reject(new Error(sanitizeUploadError(json.error || `Server responded with status ${xhr.status}`)))
        } catch {
          reject(new Error(`Server returned an unexpected response (HTTP ${xhr.status}).`))
        }
      } else {
        let errMsg = `Upload failed (HTTP ${xhr.status})`
        try {
          const json = JSON.parse(xhr.responseText)
          if (json.error) errMsg = sanitizeUploadError(json.error)
        } catch {
          // ignore
        }
        reject(new Error(errMsg))
      }
    })

    xhr.addEventListener("timeout", () => {
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
          reject(new Error("Upload request timed out."))
        }
      }
      reader.onerror = () => reject(new Error("Upload request timed out."))
      reader.readAsDataURL(file)
    })

    xhr.addEventListener("error", () => {
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
