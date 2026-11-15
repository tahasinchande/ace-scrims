export type VideoEmbedType = "youtube" | "drive" | "vimeo" | "direct"

export interface ParsedVideo {
  type: VideoEmbedType
  embedUrl: string
  originalUrl: string
  isEmbeddableIframe: boolean
  instructions?: string
  warning?: string
}

/**
 * Universal video parser for YouTube, Google Drive, Vimeo, and direct MP4/WebM links.
 * Converts watch/share URLs into proper embed URLs to prevent "refused to connect" or cropping errors.
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

  // 1. YouTube Handler (watch, youtu.be, shorts, live, embed, nocookie)
  const youtubeRegex =
    /(?:youtube(?:-nocookie)?\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
  const ytMatch = url.match(youtubeRegex)
  if (ytMatch && ytMatch[1]) {
    const videoId = ytMatch[1]
    return {
      type: "youtube",
      embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`,
      originalUrl: url,
      isEmbeddableIframe: true,
      instructions:
        "YouTube links (watch, shorts, live, youtu.be) are automatically converted into responsive 16:9 embeds.",
    }
  }

  // 2. Google Drive Folder Warning (Folders cannot be embedded as video players)
  if (/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\//i.test(url)) {
    return {
      type: "drive",
      embedUrl: url,
      originalUrl: url,
      isEmbeddableIframe: false,
      warning:
        "You pasted a Google Drive folder link. Please open the specific video file in Google Drive, click Share -> Copy link (e.g. drive.google.com/file/d/.../view), and paste that link here.",
    }
  }

  // 3. Google Drive File Handler
  // Matches /file/d/<id>, open?id=<id>, uc?id=<id>, drive.usercontent.google.com/download?id=<id>
  const driveRegex =
    /(?:drive\.google\.com\/(?:u\/\d+\/)?(?:file\/d\/([a-zA-Z0-9_-]+)|open\?.*?id=([a-zA-Z0-9_-]+)|uc\?.*?id=([a-zA-Z0-9_-]+))|drive\.usercontent\.google\.com\/(?:download|u\/\d+\/uc)\?.*?id=([a-zA-Z0-9_-]+))/i
  const driveMatch = url.match(driveRegex)
  const driveFileId = driveMatch
    ? driveMatch[1] || driveMatch[2] || driveMatch[3] || driveMatch[4]
    : null
  if (driveFileId) {
    return {
      type: "drive",
      embedUrl: `https://drive.google.com/file/d/${driveFileId}/preview`,
      originalUrl: url,
      isEmbeddableIframe: true,
      instructions:
        "Google Drive share links are automatically converted to a responsive 16:9 stream embed. Make sure file access is set to 'Anyone with the link'.",
    }
  }

  // 4. Vimeo Handler
  const vimeoRegex =
    /(?:player\.)?vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)/i
  const vimeoMatch = url.match(vimeoRegex)
  if (vimeoMatch && vimeoMatch[3]) {
    return {
      type: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[3]}?dnt=1`,
      originalUrl: url,
      isEmbeddableIframe: true,
      instructions: "Vimeo links are converted into responsive 16:9 player embeds.",
    }
  }

  // 5. Direct video files or hosted media URLs (HTML5 <video>)
  return {
    type: "direct",
    embedUrl: url,
    originalUrl: url,
    isEmbeddableIframe: false,
  }
}
