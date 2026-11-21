import {
  getAllPartnershipItems,
  getPartnershipMarqueeSettings,
} from "@/lib/queries/partnerships"
import { AdminPartnershipsManager } from "@/components/admin/admin-partnerships-manager"

export const dynamic = "force-dynamic"

export default async function AdminPartnershipsPage() {
  const [items, marqueeSettings] = await Promise.all([
    getAllPartnershipItems(),
    getPartnershipMarqueeSettings(),
  ])
  return (
    <AdminPartnershipsManager
      initialItems={items}
      initialMarqueeSettings={marqueeSettings}
    />
  )
}
