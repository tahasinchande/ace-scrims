import { ImageResponse } from "next/og"

export const size = {
  width: 180,
  height: 180,
}
export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "40px",
          background: "#090A0F",
          border: "4px solid rgba(249, 115, 22, 0.6)",
        }}
      >
        <svg
          width="130"
          height="130"
          viewBox="0 0 40 40"
          fill="none"
        >
          <defs>
            <linearGradient id="appleAceGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="60%" stopColor="#fb923c" />
              <stop offset="100%" stopColor="#fde047" />
            </linearGradient>
            <linearGradient id="appleAceGradSub" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ea580c" />
              <stop offset="100%" stopColor="#c2410c" />
            </linearGradient>
          </defs>

          <path
            d="M6 32 L20 6 L26 18 L16 32 Z"
            fill="url(#appleAceGrad)"
          />

          <path
            d="M20 6 L34 32 L24 32 L17 18 Z"
            fill="url(#appleAceGradSub)"
          />

          <path
            d="M20 12 L24 20 L20 28 L16 20 Z"
            fill="#ffffff"
            opacity="0.98"
          />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  )
}
