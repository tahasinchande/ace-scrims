/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: false,
  serverExternalPackages: ["pg", "undici"],
  turbopack: {},
  webpack: (config, { dev }) => {
    if (!dev) {
      config.cache = false
    }
    return config
  },
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  experimental: {
    cpus: 2,
    workerThreads: false,
    webpackMemoryOptimizations: true,
    preloadEntriesOnStart: false,
    turbopackFileSystemCacheForDev: true,
    turbopackMemoryLimit: 768 * 1024 * 1024,
    turbopackSourceMaps: false,
    optimizePackageImports: ["lucide-react", "motion"],
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  async headers() {
    const noStoreHeaders = [
      { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, private" },
      { key: "CDN-Cache-Control", value: "no-store" },
      { key: "Cloudflare-CDN-Cache-Control", value: "no-store" },
    ]

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
        ],
      },
      { source: "/api/:path*", headers: noStoreHeaders },
      { source: "/admin/:path*", headers: noStoreHeaders },
      { source: "/dashboard/:path*", headers: noStoreHeaders },
      { source: "/payment/:path*", headers: noStoreHeaders },
    ]
  },
}

export default nextConfig
