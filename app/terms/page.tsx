import type { Metadata } from "next"
import { LegalPage } from "@/components/site/legal-page"

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "Rules and terms for booking and playing Ace Scrims Free Fire scrims.",
}

export default function TermsPage() {
  return (
    <LegalPage title="Terms & Conditions" updated="July 14, 2026">
      <h2>1. Eligibility</h2>
      <p>
        You must have a valid Free Fire account to participate. By booking a slot you confirm that all player
        names and UIDs submitted belong to your actual squad members.
      </p>
      <h2>2. Bookings & Slots</h2>
      <ul>
        <li>Each scrim has a maximum of 12 team slots, sold on a first-paid, first-served basis.</li>
        <li>A slot is confirmed only after successful payment verification.</li>
        <li>One team may book only one slot per scrim.</li>
        <li>Slots are non-transferable without moderator approval.</li>
      </ul>
      <h2>3. Match Rules</h2>
      <ul>
        <li>All players must join the custom room at least 10 minutes before start time.</li>
        <li>Emulator players are not allowed unless the scrim explicitly permits them.</li>
        <li>Teaming with other squads, hacking, or exploiting bugs results in immediate disqualification and a
          permanent ban without refund.</li>
        <li>Room ID and password are confidential. Sharing them with non-participants leads to a ban.</li>
      </ul>
      <h2>4. Prizes</h2>
      <p>
        Prize pools are stated on each scrim page. Winning teams are announced on the results page, and prizes
        are sent to the captain&apos;s payment number within 24 hours of result publication. Result screenshots
        may be required for verification.
      </p>
      <h2>5. Conduct</h2>
      <p>
        Abusive behavior toward other players, moderators, or admins in lobby chat or community channels may
        result in suspension. Admin and moderator decisions on match disputes are final.
      </p>
      <h2>6. Changes</h2>
      <p>
        Ace Scrims may modify schedules, prize pools, or these terms. Material changes are announced via the
        site banner and notifications. Continued use of the platform constitutes acceptance.
      </p>
    </LegalPage>
  )
}
