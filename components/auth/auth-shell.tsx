"use client"

import Link from "next/link"
import Image from "next/image"
import { motion } from "motion/react"
import { RushXBrandLogo } from "@/components/site/brand-logo"

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-12">
      <Image
        src="/images/squad.jpg"
        alt=""
        fill
        priority
        className="object-cover opacity-25"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />

      {/* Background ambient glow */}
      <motion.div
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.25, 0.4, 0.25],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="pointer-events-none absolute size-96 rounded-full bg-primary/20 blur-3xl"
      />

      <div className="relative w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, type: "spring", stiffness: 220, damping: 20 }}
          className="glass rounded-2xl border border-border/80 p-8 shadow-2xl backdrop-blur-xl"
        >
          <Link href="/" className="mb-8 flex items-center justify-center group" aria-label="RushX Organization home">
            <RushXBrandLogo variant="wordmark" size="lg" />
          </Link>
          <h1 className="text-center font-display text-2xl font-bold text-balance">{title}</h1>
          <p className="mb-8 mt-2 text-center text-sm text-muted-foreground text-pretty">{subtitle}</p>
          {children}
        </motion.div>
      </div>
    </main>
  )
}

