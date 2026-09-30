export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"

// Convenience alias: the staff panel lives at /botsito for both roles.
export default function ModRedirect() {
  redirect("/botsito")
}
