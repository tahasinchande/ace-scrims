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
  experimental: {
    cpus: 1,
    workerThreads: false,
    webpackMemoryOptimizations: true,
    preloadEntriesOnStart: false,
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
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
    ]
  },
}

export default nextConfig
