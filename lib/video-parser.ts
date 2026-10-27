export type VideoEmbedType = "youtube" | "drive" | "vimeo" | "direct"

export interface ParsedVideo {
  type: VideoEmbedType
  embedUrl: string
  originalUrl: string
  isEmbeddableIframe: boolean
  instructions?: string
}

/**
 * Universal video parser for YouTube, Google Drive, Vimeo, and direct MP4/WebM links.
 * Converts watch/share URLs into proper embed URLs to prevent "refused to connect" iframe errors.
 */
export function parseVideoEmbed(rawUrl: string): ParsedVideo {
  if (!rawUrl || typeof rawUrl !== "string") {
    return {
      type: "direct",
      embedUrl: "",
      originalUrl: "",
      isEmbeddableIframe: false,
    }
  }

  const url = rawUrl.trim()

  // 1. YouTube Handler
  // Matches:
  // - https://www.youtube.com/watch?v=dQw4w9WgXcQ
  // - https://youtu.be/dQw4w9WgXcQ
  // - https://www.youtube.com/shorts/dQw4w9WgXcQ
  // - https://m.youtube.com/watch?v=dQw4w9WgXcQ
  // - https://www.youtube.com/embed/dQw4w9WgXcQ
  const youtubeRegex =
    /(?:youtube(?:-nocookie)?\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
  const ytMatch = url.match(youtubeRegex)
  if (ytMatch && ytMatch[1]) {
    const videoId = ytMatch[1]
    return {
      type: "youtube",
      embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`,
      originalUrl: url,
      isEmbeddableIframe: true,
      instructions: "YouTube standard links are automatically converted to clean embeds to prevent connection errors.",
    }
  }

  // 2. Google Drive Handler
  // Matches:
  // - https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view?usp=sharing
  // - https://drive.google.com/open?id=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
  // - https://drive.google.com/uc?id=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
  // - https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/preview
  const driveRegex =
    /drive\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|open\?id=([a-zA-Z0-9_-]+)|uc\?(?:export=[^&]+&)?id=([a-zA-Z0-9_-]+))/i
  const driveMatch = url.match(driveRegex)
  const driveFileId = driveMatch ? driveMatch[1] || driveMatch[2] || driveMatch[3] : null
  if (driveFileId) {
    return {
      type: "drive",
      embedUrl: `https://drive.google.com/file/d/${driveFileId}/preview`,
      originalUrl: url,
      isEmbeddableIframe: true,
      instructions: "Google Drive share links are converted to direct preview embeds. Ensure file sharing is set to Anyone with the link can view.",
    }
  }

  // 3. Vimeo Handler
  // Matches: https://vimeo.com/123456789
  const vimeoRegex = /vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|)(\d+)/i
  const vimeoMatch = url.match(vimeoRegex)
  if (vimeoMatch && vimeoMatch[3]) {
    return {
      type: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[3]}`,
      originalUrl: url,
      isEmbeddableIframe: true,
    }
  }

  // 4. Direct video files or cloud storage URLs (HTML5 <video>)
  return {
    type: "direct",
    embedUrl: url,
    originalUrl: url,
    isEmbeddableIframe: false,
  }
}
