import type { Metadata } from "next"
import { requireUser } from "@/lib/session"
import { getUserAllImageRequests } from "@/app/actions/image-requests"
import { ImageRequestsView } from "@/components/dashboard/image-requests-view"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Image Requests — Ace Scrims",
  description: "Upload your team MVP photos and track requested banners.",
}

export default async function ImageRequestsPage() {
  const user = await requireUser()
  const requests = await getUserAllImageRequests(user.id)

  return <ImageRequestsView requests={requests} />
}
