import { redirect } from "next/navigation"

// Convenience alias: the staff panel lives at /admin for both roles.
export default function ModeratorRedirect() {
  redirect("/admin")
}
