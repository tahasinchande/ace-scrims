import {
  getActivePartnershipItems,
  getPartnershipMarqueeSettings,
} from "@/lib/queries/partnerships"
import { PartnershipTicker } from "@/components/site/partnership-ticker"

export async function PartnershipTickerBar({ compact = false }: { compact?: boolean }) {
  const [items, marqueeSettings] = await Promise.all([
    getActivePartnershipItems(),
    getPartnershipMarqueeSettings(),
  ])
  if (!marqueeSettings.enabled || items.length === 0) return null
  return <PartnershipTicker items={items} marqueeSettings={marqueeSettings} compact={compact} />
}
