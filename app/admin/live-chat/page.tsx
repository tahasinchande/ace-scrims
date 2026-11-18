import { requireStaff } from "@/lib/session"
import { getAdminChatHubData } from "@/app/actions/chat"
import { AdminLiveChatHub } from "@/components/admin/admin-live-chat-hub"

export const dynamic = "force-dynamic"

export default async function AdminLiveChatPage() {
  const staff = await requireStaff()
  const hubData = await getAdminChatHubData()

  return <AdminLiveChatHub initialHubData={hubData} staffUserId={staff.id} />
}
