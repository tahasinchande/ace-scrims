import { LegalPage } from "@/components/site/legal-page"

export const metadata = { title: "Refund Policy" }

export default function RefundPolicyPage() {
  return (
    <LegalPage title="Refund Policy" updated="July 14, 2026">
      <h2>Overview</h2>
      <p>
        Ace Scrims sells entry slots for scheduled Free Fire scrim matches. Because slots are limited and reserved
        immediately upon successful payment, refunds are governed by the rules below.
      </p>

      <h2>When You Are Eligible for a Refund</h2>
      <ul>
        <li>The scrim is cancelled by Ace Scrims for any reason.</li>
        <li>The match could not start due to a fault on our side (e.g. room was never published).</li>
        <li>You were charged twice for the same slot &mdash; the duplicate charge is refunded in full.</li>
        <li>Payment succeeded but no slot was available; your payment is refunded in full.</li>
      </ul>

      <h2>When Refunds Are Not Provided</h2>
      <ul>
        <li>Your team fails to join the room before the match starts.</li>
        <li>Your team is removed for breaking scrim rules (teaming, emulator use, abusive behavior).</li>
        <li>You change your mind after booking &mdash; slots are reserved instantly and cannot be resold in time.</li>
        <li>Connectivity or device issues on the player&apos;s side.</li>
      </ul>

      <h2>How Refunds Are Processed</h2>
      <p>
        Eligible refunds are returned to the original payment method (bKash, Nagad, Rocket, or card) within 3&ndash;7
        business days. Contact us with your transaction ID via the contact section on the home page, our Discord
        server, or our Facebook page to request a refund.
      </p>

      <h2>Questions</h2>
      <p>
        If you believe a charge was made in error, reach out as soon as possible with your transaction ID and the
        email address on your account. We review every request within 24 hours.
      </p>
    </LegalPage>
  )
}
