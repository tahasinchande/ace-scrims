/**
 * Client-Side Image Compression & Optimization Utility
 *
 * Compresses and resizes high-resolution images (up to 10MB+) on the client side
 * before upload, reducing payload sizes from multi-megabytes down to ~30-100KB.
 * This completely avoids Vercel's 4.5MB serverless function payload limit.
 */

export type CompressOptions = {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  mimeType?: "image/webp" | "image/jpeg" | "image/png"
}

/**
 * Compresses an image file on the client using HTML5 Canvas.
 * @param file The original user-selected file (up to 10MB)
 * @param options Compression and resizing options
 * @returns A compressed File object (usually ~30KB - 100KB)
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const {
    maxWidth = 512,
    maxHeight = 512,
    quality = 0.85,
    mimeType = "image/webp",
  } = options

  // If running in a non-browser environment or file is not an image, return original
  if (typeof window === "undefined" || !file.type.startsWith("image/")) {
    return file
  }

  return new Promise((resolve) => {
    const reader = new FileReader()

    reader.onerror = () => {
      console.warn("[Image Compress] FileReader failed, using original file.")
      resolve(file)
    }

    reader.onload = (event) => {
      const img = new Image()

      img.onerror = () => {
        console.warn("[Image Compress] Image loading failed, using original file.")
        resolve(file)
      }

      img.onload = () => {
        try {
          let { width, height } = img

          // Calculate new dimensions keeping aspect ratio
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width)
              width = maxWidth
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height)
              height = maxHeight
            }
          }

          const canvas = document.createElement("canvas")
          canvas.width = Math.max(1, width)
          canvas.height = Math.max(1, height)

          const ctx = canvas.getContext("2d", { alpha: mimeType === "image/webp" || mimeType === "image/png" })
          if (!ctx) {
            resolve(file)
            return
          }

          // High-quality image smoothing
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = "high"

          ctx.drawImage(img, 0, 0, width, height)

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file)
                return
              }

              // Determine output extension
              const ext = mimeType === "image/webp" ? ".webp" : mimeType === "image/png" ? ".png" : ".jpg"
              const baseName = file.name.replace(/\.[^/.]+$/, "")
              const newFileName = `${baseName}_optimized${ext}`

              const compressedFile = new File([blob], newFileName, {
                type: mimeType,
                lastModified: Date.now(),
              })

              resolve(compressedFile)
            },
            mimeType,
            quality
          )
        } catch (canvasErr) {
          console.warn("[Image Compress] Canvas processing failed, fallback to original:", canvasErr)
          resolve(file)
        }
      }

      if (typeof event.target?.result === "string") {
        img.src = event.target.result
      } else {
        resolve(file)
      }
    }

    reader.readAsDataURL(file)
  })
}
