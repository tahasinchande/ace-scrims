"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-[#030407] text-white p-6 text-center">
        <h2 className="text-2xl font-bold mb-3 tracking-wide uppercase">
          Something went wrong
        </h2>
        <p className="text-sm text-neutral-400 max-w-md mb-6 leading-relaxed">
          An unexpected application error occurred. You can retry the action or reload the page.
        </p>
        {error?.digest && (
          <p className="text-xs text-neutral-500 mb-4 font-mono">Error ID: {error.digest}</p>
        )}
        <button
          type="button"
          onClick={() => reset()}
          className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold uppercase text-xs transition-colors"
        >
          Try again
        </button>
      </body>
    </html>
  )
}
