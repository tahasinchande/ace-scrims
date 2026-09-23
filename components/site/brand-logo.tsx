"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface BrandLogoProps {
  className?: string
  size?: "sm" | "md" | "lg" | "xl"
  showText?: boolean
  showDynamicLogo?: boolean
  interactive?: boolean
  withBackground?: boolean
  logoUrl?: string
}

export function AceScrimsBrandLogo({
  className,
  size = "md",
  showText = true,
  showDynamicLogo = true,
  logoUrl,
}: BrandLogoProps) {
  // Dimensions per size
  const iconSizeMap = {
    sm: "size-7",
    md: "size-8",
    lg: "size-10",
    xl: "size-12",
  }

  const textClassMap = {
    sm: "text-base tracking-tight",
    md: "text-lg tracking-tight",
    lg: "text-2xl tracking-tight",
    xl: "text-3xl tracking-tight",
  }

  return (
    <div
      className={cn(
        "group inline-flex items-center gap-2.5 select-none transition-opacity hover:opacity-95",
        className
      )}
    >
      {/* Sleek Modern Apex Mark Logo or Custom Uploaded Logo */}
      {showDynamicLogo && (
        <div className={cn("relative shrink-0 flex items-center justify-center overflow-hidden rounded-md", iconSizeMap[size])}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Ace Scrims Logo"
              className="h-full w-full object-contain drop-shadow-sm transition-transform duration-200 group-hover:scale-105"
            />
          ) : (
            <svg
              viewBox="0 0 40 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-full drop-shadow-sm transition-transform duration-200 group-hover:scale-105"
            >
              <defs>
                <linearGradient id="aceBrandGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="60%" stopColor="#fb923c" />
                  <stop offset="100%" stopColor="#fde047" />
                </linearGradient>
                <linearGradient id="aceBrandGradSub" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ea580c" />
                  <stop offset="100%" stopColor="#c2410c" />
                </linearGradient>
              </defs>

              {/* Left Dynamic Wing / Geometric Apex */}
              <path
                d="M6 32 L20 6 L26 18 L16 32 Z"
                fill="url(#aceBrandGrad)"
              />

              {/* Right Dynamic Wing / Forward Thrust */}
              <path
                d="M20 6 L34 32 L24 32 L17 18 Z"
                fill="url(#aceBrandGradSub)"
              />

              {/* Central Diamond Core */}
              <path
                d="M20 12 L24 20 L20 28 L16 20 Z"
                fill="#ffffff"
                opacity="0.95"
              />
            </svg>
          )}
        </div>
      )}

      {/* Clean Modern Typography */}
      {showText && (
        <div className="flex items-center gap-1.5 leading-none">
          <span className={cn("font-display font-extrabold uppercase text-white drop-shadow-sm", textClassMap[size])}>
            ACE
          </span>
          <span
            className={cn(
              "font-display font-extrabold uppercase bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent",
              textClassMap[size]
            )}
          >
            SCRIMS
          </span>
        </div>
      )}
    </div>
  )
}
