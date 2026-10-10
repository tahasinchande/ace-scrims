import { requireStaff } from "@/lib/session"
import { getStaffChatConversations } from "@/app/actions/chat"
import { AdminLiveChatHub } from "@/components/admin/admin-live-chat-hub"

export const dynamic = "force-dynamic"

export default async function AdminLiveChatPage() {
  const staff = await requireStaff()
  const conversations = await getStaffChatConversations().catch(() => [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Live Support Chat</h1>
        <p className="text-sm text-muted-foreground">
          Real-time player support hub. Chat directly with players, send screenshots/credentials, and resolve verification queries.
        </p>
      </div>
      <AdminLiveChatHub initialConversations={conversations} staffUserId={staff.id} />
    </div>
  )
}
