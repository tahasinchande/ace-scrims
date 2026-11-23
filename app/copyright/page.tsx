import type { Metadata } from "next"
import { LegalPage } from "@/components/site/legal-page"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Copyright Notice — RushX Organization",
  description: "Copyright and intellectual property information for RushX Organization.",
}

export default function CopyrightPage() {
  return (
    <LegalPage title="Copyright Notice" updated="October 16, 2026">
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 text-sm text-foreground leading-relaxed shadow-sm">
        <p className="font-semibold text-base text-primary mb-2">
          Official Copyright Declaration:
        </p>
        <p className="italic">
          “© 2026 RushX Organization. All rights reserved. Original source code, content, graphics, and branding created for RushX Organization are protected by applicable copyright laws. Unauthorized copying or reproduction without permission is prohibited, except where permitted by law. Third-party materials remain subject to their respective owners’ rights.”
        </p>
      </div>

      <h2>1. Ownership of Materials</h2>
      <p>
        All original software, source code, visual designs, user interfaces, branding assets, logos, text, graphics, illustrations, database structures, and editorial content published on RushX Organization (acescrims.online) are the exclusive property of RushX Organization and are protected by applicable international copyright, trademark, and intellectual property conventions.
      </p>

      <h2>2. Permitted Use</h2>
      <p>
        Users, players, and esports teams are granted a limited, personal, non-exclusive, non-transferable license to access and use the platform solely for the purpose of browsing tournament scrim schedules, registering squads, verifying room credentials, viewing match leaderboards, and submitting reports in accordance with our Terms of Service.
      </p>

      <h2>3. Prohibited Activities</h2>
      <p>
        Except as explicitly authorized in writing by RushX Organization, you may not:
      </p>
      <ul>
        <li>Copy, modify, reverse engineer, decompile, or extract the source code or database schemas of this platform.</li>
        <li>Scrape, duplicate, or mirror tournament data, room formats, or custom esports graphics for commercial resale or competing services.</li>
        <li>Rebrand, republish, or distribute platform graphics, badges, or brand marks without prior express consent.</li>
      </ul>

      <h2>4. Third-Party Trademarks &amp; Materials</h2>
      <p>
        Garena Free Fire, Free Fire MAX, and associated map names, character icons, and in-game imagery are registered trademarks and copyrights of Garena International / Sea Limited. RushX Organization is an independent grassroots esports tournament management platform organized for community competition and is not officially affiliated with or endorsed by Garena. All third-party trademarks and trade names remain the property of their respective owners.
      </p>

      <h2>5. Copyright Infringement &amp; Takedown Requests</h2>
      <p>
        If you believe that any material available on or through the RushX Organization platform infringes upon your copyright, please submit an infringement notice including proof of ownership, identification of the copyrighted work, and contact details via our official Direct WhatsApp Support or Live Support channels.
      </p>
    </LegalPage>
  )
}
