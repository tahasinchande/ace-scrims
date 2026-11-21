import { getActivePartnershipItems } from "@/lib/queries/partnerships"
import { PartnershipTicker } from "@/components/site/partnership-ticker"

export async function PartnershipTickerBar() {
  const items = await getActivePartnershipItems()
  if (items.length === 0) return null
  return <PartnershipTicker items={items} />
}
