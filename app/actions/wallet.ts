"use server"

import { randomUUID } from "crypto"
import { db, ensureSchemaReady } from "@/lib/db"
import { user, payments, walletTransactions } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { requireUser } from "@/lib/session"
import { createCharge } from "@/lib/uddoktapay"
import { resolveAppBaseUrl } from "@/lib/base-url"

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

  try {
    await ensureSchemaReady()
    const baseUrl = await resolveAppBaseUrl()

    // Pre-insert pending payment record
    await db.insert(payments).values({
      id: paymentId,
      userId: sessionUser.id,
      bookingId: "wallet_deposit",
      scrimId: "wallet_deposit",
      amountBdt: amount,
      method: "online_gateway",
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
        .catch(() => {})
      return { ok: false, error: charge.error || "Failed to initialize payment gateway." }
    }

    return { ok: true, paymentUrl: charge.paymentUrl }
  } catch (err) {
    console.error("[Wallet] createWalletDeposit error:", err)
    await db
      .update(payments)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(payments.id, paymentId))
      .catch(() => {})
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Unable to initialize wallet deposit right now. Please try again.",
    }
  }
}

export async function getUserWalletData() {
  await ensureSchemaReady()
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
