import { z } from "zod"

export const creditAdjustmentSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  actionType: z.enum(["add", "deduct", "set"]),
  amount: z.coerce.number().int().min(0, "Amount must be a non-negative number"),
  reason: z.string().trim().min(2, "Please provide a valid reason / note (minimum 2 characters)"),
})

export type CreditAdjustmentInput = z.infer<typeof creditAdjustmentSchema>
