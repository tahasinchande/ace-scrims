import type { MetadataRoute } from "next"
import { BRAND } from "@/lib/brand"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.shortName,
    description:
      "Daily competitive Free Fire scrims in Bangladesh organized by RushX Organization.",
    start_url: "/",
    display: "standalone",
    background_color: "#050811",
    theme_color: "#050811",
    icons: [
      {
        src: BRAND.assets.favicon64,
        sizes: "64x64",
        type: "image/png",
      },
      {
        src: BRAND.assets.appleIcon180,
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: BRAND.assets.favicon192,
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: BRAND.assets.symbol,
        sizes: "512x512",
        type: "image/png",
      },
    ],
  }
}
