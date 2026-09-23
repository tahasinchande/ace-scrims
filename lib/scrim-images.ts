export const MAP_IMAGES: Record<string, string> = {
  BERMUDA: "/images/bermuda.jpg",
  PURGATORY: "/images/purgatory.jpg",
  KALAHARI: "/images/kalahari.jpg",
  ALPINE: "/images/alpine.jpg",
  NEXTERRA: "/images/nexterra.jpg",
}

export const SCRIM_BACKGROUND_IMAGES = [
  "/images/scrim-1.jpg",
  "/images/scrim-2.jpg",
  "/images/scrim-3.jpg",
  "/images/scrim-4.jpg",
  "/images/scrim-5.jpg",
  "/images/scrim-6.jpg",
  "/images/scrim-7.jpg",
  "/images/scrim-8.jpg",
  "/images/scrim-9.jpg",
  "/images/scrim-10.jpg",
  "/images/scrim-11.jpg",
  "/images/scrim-12.jpg",
  "/images/bermuda.jpg",
  "/images/purgatory.jpg",
  "/images/kalahari.jpg",
  "/images/alpine.jpg",
  "/images/nexterra.jpg",
  "/images/sakura-wallpaper.jpg",
] as const

/**
 * Returns a random scrim image from the uploaded background assets in src/assets/images.
 * If a seed string (e.g. scrim slug or id) is passed, returns a consistent deterministic pseudo-random image.
 */
export function getRandomScrimImage(seed?: string | number): string {
  if (seed !== undefined && seed !== null) {
    let hash = 0
    const str = String(seed)
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i)
      hash |= 0
    }
    const idx = Math.abs(hash) % SCRIM_BACKGROUND_IMAGES.length
    return SCRIM_BACKGROUND_IMAGES[idx]
  }
  const randomIdx = Math.floor(Math.random() * SCRIM_BACKGROUND_IMAGES.length)
  return SCRIM_BACKGROUND_IMAGES[randomIdx]
}

export function getMapImage(mapName?: string | null): string {
  if (!mapName) return "/images/bermuda.jpg"
  const upper = mapName.trim().toUpperCase()
  for (const [key, val] of Object.entries(MAP_IMAGES)) {
    if (upper.includes(key)) return val
  }
  return getRandomScrimImage(mapName)
}
