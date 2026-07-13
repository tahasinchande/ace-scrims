import type { Metadata } from "next"
import { LegalPage } from "@/components/site/legal-page"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Ace Scrims collects, uses, and protects your personal information.",
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="July 14, 2026">
      <h2>1. Information We Collect</h2>
      <p>
        When you create an account or book a scrim slot on Ace Scrims, we collect the information you provide:
        your name, email address, phone number, Free Fire player names and UIDs for your squad, and optional
        Discord or Telegram contact details.
      </p>
      <h2>2. Payment Information</h2>
      <p>
        Payments are processed by UddoktaPay (bKash, Nagad, Rocket, and cards). We never store your payment PIN,
        card number, or wallet credentials. We only store the transaction ID, amount, payment method, and status
        needed to confirm your booking and handle refunds.
      </p>
      <h2>3. How We Use Your Information</h2>
      <ul>
        <li>To register your team into scrim lobbies and share Room ID and password with paid participants.</li>
        <li>To send booking confirmations, match notifications, and result announcements.</li>
        <li>To verify payments, prevent duplicate or fraudulent bookings, and process refunds.</li>
        <li>To contact you about disputes, rule violations, or prize distribution.</li>
      </ul>
      <h2>4. Data Sharing</h2>
      <p>
        We do not sell your personal data. Team names and results are displayed publicly on the results
        leaderboard. Player UIDs are shared only with match moderators for lobby verification.
      </p>
      <h2>5. Data Security</h2>
      <p>
        Passwords are hashed using industry-standard algorithms. Sessions use secure, HTTP-only cookies. All
        traffic is encrypted over HTTPS, and database access is restricted and scoped per user.
      </p>
      <h2>6. Your Rights</h2>
      <p>
        You may update your profile information at any time from your dashboard settings, and you may request
        account deletion by contacting us. Deleting your account removes your personal data, while anonymized
        match results may be retained for leaderboard integrity.
      </p>
      <h2>7. Contact</h2>
      <p>For any privacy questions, reach us through the contact section on the homepage or via Discord.</p>
    </LegalPage>
  )
}
