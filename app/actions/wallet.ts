"use server"

import { randomUUID } from "crypto"
import { db } from "@/lib/db"
import { user, payments, walletTransactions } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { requireUser } from "@/lib/session"
import { createCharge } from "@/lib/uddoktapay"

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    const raw = process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, "")
    if (raw && !raw.includes("localhost") && !raw.includes("vercel.app")) {
      return raw.startsWith("http") ? raw : `https://${raw}`
    }
  }
  if (process.env.BETTER_AUTH_URL) {
    const raw = process.env.BETTER_AUTH_URL.trim().replace(/\/$/, "")
    if (raw && !raw.includes("localhost") && !raw.includes("vercel.app")) {
      return raw.startsWith("http") ? raw : `https://${raw}`
    }
  }
  return "https://www.acescrims.online"
}

export type WalletDepositResult = {
  ok: boolean
  error?: string
  paymentUrl?: string
}

export async function createWalletDeposit(amountBdt: number): Promise<WalletDepositResult> {
  let sessionUser
  try {
    sessionUser = await requireUser()
  } catch {
    return { ok: false, error: "Please sign in to load your wallet balance." }
  }

  if (!sessionUser.emailVerified) {
    return {
      ok: false,
      error: "Please verify your email address before depositing funds.",
    }
  }

  const amount = Math.floor(amountBdt)
  if (isNaN(amount) || amount < 10) {
    return { ok: false, error: "Minimum deposit amount is ৳10." }
  }
  if (amount > 25000) {
    return { ok: false, error: "Maximum single deposit is ৳25,000." }
  }

  const paymentId = randomUUID()
  const baseUrl = getBaseUrl()

  // Pre-insert pending payment record
  await db.insert(payments).values({
    id: paymentId,
    userId: sessionUser.id,
    bookingId: "wallet_deposit",
    scrimId: "wallet_deposit",
    amountBdt: amount,
    method: "uddoktapay",
    status: "pending",
  })

  const charge = await createCharge({
    fullName: sessionUser.name,
    email: sessionUser.email,
    amount,
    metadata: {
      type: "wallet_deposit",
      payment_id: paymentId,
      user_id: sessionUser.id,
      amount: String(amount),
    },
    redirectUrl: `${baseUrl}/payment/callback?pid=${paymentId}&type=wallet`,
    cancelUrl: `${baseUrl}/dashboard/wallet?status=cancelled`,
    webhookUrl: `${baseUrl}/api/payment/webhook`,
  })

  if (!charge.ok) {
    await db
      .update(payments)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(payments.id, paymentId))
    return { ok: false, error: charge.error || "Failed to initialize payment gateway." }
  }

  return { ok: true, paymentUrl: charge.paymentUrl }
}

export async function getUserWalletData() {
  const sessionUser = await requireUser()

  const [uRow, history] = await Promise.all([
    db
      .select({ balance: user.balance })
      .from(user)
      .where(eq(user.id, sessionUser.id))
      .limit(1),
    db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.userId, sessionUser.id))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(30),
  ])

  return {
    balance: uRow[0]?.balance ?? 0,
    transactions: history,
  }
}
