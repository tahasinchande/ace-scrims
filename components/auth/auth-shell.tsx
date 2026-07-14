import Link from "next/link"
import Image from "next/image"
import { Zap } from "lucide-react"

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

      <div className="relative w-full max-w-md">
        <div className="glass-card rounded-2xl border border-border/60 p-8 shadow-2xl">
          <Link href="/" className="mb-8 flex items-center justify-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Zap className="size-5" />
            </span>
            <span className="font-display text-xl font-bold tracking-wide">
              ACE<span className="text-primary">SCRIMS</span>
            </span>
          </Link>
          <h1 className="text-center font-display text-2xl font-bold text-balance">{title}</h1>
          <p className="mb-8 mt-2 text-center text-sm text-muted-foreground text-pretty">{subtitle}</p>
          {children}
        </div>
      </div>
    </main>
  )
}
