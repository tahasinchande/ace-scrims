import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

const defaultUrl =
  "postgresql://neondb_owner:npg_pohQHa4w0bsg@ep-noisy-wind-at1cd952-pooler.c-9.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require"

function getDatabaseConnectionString(): string {
  let url = (process.env.DATABASE_URL || defaultUrl).trim()
  if (!url.includes("sslmode=")) {
    url += (url.includes("?") ? "&" : "?") + "sslmode=require"
  }
  return url
}

const connectionString = getDatabaseConnectionString()

const isSSL = connectionString.includes("sslmode=require") || connectionString.includes("neon.tech")

export const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 10000,
  ssl: isSSL ? { rejectUnauthorized: false } : undefined,
})

pool.on("error", (err: Error) => {
  console.warn("[Database] Pool error:", err.message)
})

export const db = drizzle(pool, { schema })

// Automatically ensure new schema columns and tables exist in PostgreSQL
async function ensureSchema() {
  try {
    const client = await pool.connect()
    try {
      const statements = [
        `ALTER TABLE "results" ADD COLUMN IF NOT EXISTS "category" text NOT NULL DEFAULT 'Top 3 Prize Pool'`,
        `ALTER TABLE "results" ADD COLUMN IF NOT EXISTS "imageUrls" jsonb`,
        `ALTER TABLE "results" ADD COLUMN IF NOT EXISTS "mvpPlayerName" text`,
        `ALTER TABLE "results" ADD COLUMN IF NOT EXISTS "mvpTeamName" text`,
        `ALTER TABLE "results" ADD COLUMN IF NOT EXISTS "isTrashed" boolean NOT NULL DEFAULT false`,
        `ALTER TABLE "results" ADD COLUMN IF NOT EXISTS "deletedAt" timestamp`,
        `ALTER TABLE "scrims" ADD COLUMN IF NOT EXISTS "hidden" boolean NOT NULL DEFAULT false`,
        `ALTER TABLE "scrims" ADD COLUMN IF NOT EXISTS "deletedAt" timestamp`,
        `ALTER TABLE "scrims" ADD COLUMN IF NOT EXISTS "isTrashed" boolean NOT NULL DEFAULT false`,
        `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "scrimDate" text`,
        `UPDATE "bookings" SET "scrimDate" = COALESCE("scrimDate", (("createdAt" AT TIME ZONE 'Asia/Dhaka')::date)::text) WHERE "scrimDate" IS NULL`,
        `CREATE INDEX IF NOT EXISTS "idx_bookings_scrim_date_status" ON "bookings" ("scrimId", "scrimDate", "status")`,
        `CREATE INDEX IF NOT EXISTS "idx_bookings_user_date_status" ON "bookings" ("userId", "scrimDate", "status")`,
        `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "isTrashed" boolean NOT NULL DEFAULT false`,
        `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "deletedAt" timestamp`,
        `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "phone" text`,
        `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "isTrashed" boolean NOT NULL DEFAULT false`,
        `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "deletedAt" timestamp`,
        `CREATE TABLE IF NOT EXISTS "reports" (
          "id" text PRIMARY KEY,
          "userId" text NOT NULL,
          "scrimId" text,
          "reportType" text NOT NULL DEFAULT 'General Report',
          "description" text NOT NULL,
          "proofUrl" text,
          "status" text NOT NULL DEFAULT 'pending',
          "type" text,
          "whatsapp" text,
          "hackerUid" text,
          "hackerName" text,
          "uid" text,
          "name" text,
          "trxid" text,
          "bookingDetails" text,
          "additionalInfo" text,
          "imageUrl" text,
          "videoUrl" text,
          "createdAt" timestamp NOT NULL DEFAULT NOW(),
          "updatedAt" timestamp NOT NULL DEFAULT NOW()
        )`,
        `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "scrimId" text`,
        `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "reportType" text NOT NULL DEFAULT 'General Report'`,
        `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "proofUrl" text`,
        `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "type" text`,
        `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "whatsapp" text`,
        `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "hackerUid" text`,
        `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "hackerName" text`,
        `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "uid" text`,
        `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "name" text`,
        `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "trxid" text`,
        `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "bookingDetails" text`,
        `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "additionalInfo" text`,
        `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "imageUrl" text`,
        `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "videoUrl" text`,
        `ALTER TABLE "reports" ALTER COLUMN "type" DROP NOT NULL`,
        `ALTER TABLE "reports" ALTER COLUMN "whatsapp" DROP NOT NULL`,
        `CREATE TABLE IF NOT EXISTS "tutorials" (
          "id" text PRIMARY KEY,
          "title" text NOT NULL,
          "videoUrl" text NOT NULL,
          "description" text,
          "publishedBy" text,
          "createdAt" timestamp NOT NULL DEFAULT NOW()
        )`,
        `CREATE TABLE IF NOT EXISTS "chat_messages" (
          "id" text PRIMARY KEY,
          "userId" text NOT NULL,
          "senderId" text NOT NULL,
          "senderName" text NOT NULL,
          "senderRole" text NOT NULL DEFAULT 'user',
          "message" text NOT NULL,
          "attachmentUrl" text,
          "attachmentType" text,
          "attachmentName" text,
          "readByStaff" boolean NOT NULL DEFAULT false,
          "readByUser" boolean NOT NULL DEFAULT false,
          "createdAt" timestamp NOT NULL DEFAULT NOW()
        )`,
        `ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "attachmentUrl" text`,
        `ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "attachmentType" text`,
        `ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "attachmentName" text`,
        `CREATE TABLE IF NOT EXISTS "not_hosted_teams" (
          "id" text PRIMARY KEY,
          "scrimId" text NOT NULL,
          "scrimTitle" text NOT NULL,
          "scrimDate" text NOT NULL,
          "scrimTime" text NOT NULL,
          "bookingId" text NOT NULL,
          "userId" text NOT NULL,
          "teamName" text NOT NULL,
          "captainName" text NOT NULL,
          "captainUid" text,
          "phone" text NOT NULL,
          "paymentId" text,
          "invoiceId" text,
          "transactionId" text,
          "amountBdt" integer NOT NULL DEFAULT 35,
          "paymentMethod" text,
          "senderNumber" text,
          "refundStatus" text NOT NULL DEFAULT 'pending',
          "refundRef" text,
          "refundError" text,
          "createdAt" timestamp NOT NULL DEFAULT NOW(),
          "updatedAt" timestamp NOT NULL DEFAULT NOW()
        )`,
        `ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "bookingId" text`,
        `ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "scrimId" text`,
        `ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "scrimTitle" text`,
        `ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "scrimDate" text`,
        `ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "scrimTime" text`,
        `ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "userId" text`,
        `ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "teamName" text`,
        `ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "captainName" text`,
        `ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "phone" text`,
        `ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "amountBdt" integer DEFAULT 35`,
        `ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "refundStatus" text DEFAULT 'pending'`,
        `ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "transactionId" text`,
        `ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "invoiceId" text`,
        `ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "paymentMethod" text`,
        `ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "senderNumber" text`,
        `ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "captainUid" text`,
        `ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "paymentId" text`,
        `ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "refundRef" text`,
        `ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "refundError" text`,
        `ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp DEFAULT NOW()`,
        `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "transactionId" text`,
        `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "invoiceId" text`,
        `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "teamLeaderImageUrl" text`,
        `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "paymentNumber" text`,
        `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "teamMembersDriveLink" text`,
        `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "imageRequested" boolean NOT NULL DEFAULT false`,
        `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "imageRequestedAt" timestamp`,
        `CREATE TABLE IF NOT EXISTS "image_requests" (
          "id" text PRIMARY KEY,
          "scrimId" text NOT NULL,
          "scrimTitle" text,
          "bookingId" text NOT NULL,
          "userId" text NOT NULL,
          "teamName" text NOT NULL,
          "captainName" text,
          "captainUid" text,
          "status" text NOT NULL DEFAULT 'pending',
          "requestType" text NOT NULL DEFAULT 'MVP/Top 3 Image',
          "submittedTeamName" text,
          "submittedPlayerUid" text,
          "uploadedImageUrls" jsonb,
          "notes" text,
          "requestedBy" text,
          "requestedAt" timestamp NOT NULL DEFAULT NOW(),
          "submittedAt" timestamp,
          "createdAt" timestamp NOT NULL DEFAULT NOW(),
          "updatedAt" timestamp NOT NULL DEFAULT NOW()
        )`,
        `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "isArchived" boolean NOT NULL DEFAULT false`,
        `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "archivedAt" timestamp`,
        `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "isTrashed" boolean NOT NULL DEFAULT false`,
        `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "deletedAt" timestamp`,
        `ALTER TABLE "image_requests" ADD COLUMN IF NOT EXISTS "isTrashed" boolean NOT NULL DEFAULT false`,
        `ALTER TABLE "image_requests" ADD COLUMN IF NOT EXISTS "deletedAt" timestamp`,
        `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "isTrashed" boolean NOT NULL DEFAULT false`,
        `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "deletedAt" timestamp`,
        `DELETE FROM "settings" WHERE "key" = 'support_phone'`,
        `UPDATE "scrims" SET "map" = 'Champion Mode (Max 8 Matches)', "priceBdt" = 50, "prizePoolBdt" = 480 WHERE "slug" = '10-pm-champion-rush' OR "slug" = '3-pm-champion-rush' OR "id" LIKE '%-cr' OR "title" ILIKE '%Champion Rush%'`,
        `UPDATE "scrims" SET "priceBdt" = 35, "prizePoolBdt" = 330 WHERE ("category" = 'Daily Scrims' OR "id" LIKE 'scrim-%') AND "category" NOT LIKE '%Blast%' AND "slug" NOT LIKE '%champion-rush%' AND "id" NOT LIKE '%-cr'`
      ]

      for (const stmt of statements) {
        try {
          await client.query(stmt)
        } catch (stmtErr) {
          console.warn("[Database] ensureSchema statement failed (continuing):", stmtErr)
        }
      }
    } finally {
      client.release()
    }
  } catch (err) {
    console.warn("[Database] ensureSchema connection error:", err)
  }
}

// Run schema verification asynchronously
ensureSchema()

export async function ensureNotHostedTable() {
  try {
    const client = await pool.connect()
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS "not_hosted_teams" (
          "id" text PRIMARY KEY,
          "scrimId" text NOT NULL,
          "scrimTitle" text NOT NULL,
          "scrimDate" text NOT NULL,
          "scrimTime" text NOT NULL,
          "bookingId" text NOT NULL,
          "userId" text NOT NULL,
          "teamName" text NOT NULL,
          "captainName" text NOT NULL,
          "captainUid" text,
          "phone" text NOT NULL,
          "paymentId" text,
          "invoiceId" text,
          "transactionId" text,
          "amountBdt" integer NOT NULL DEFAULT 35,
          "paymentMethod" text,
          "senderNumber" text,
          "refundStatus" text NOT NULL DEFAULT 'pending',
          "refundRef" text,
          "refundError" text,
          "createdAt" timestamp NOT NULL DEFAULT NOW(),
          "updatedAt" timestamp NOT NULL DEFAULT NOW()
        );
        ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "bookingId" text;
        ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "scrimId" text;
        ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "scrimTitle" text;
        ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "scrimDate" text;
        ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "scrimTime" text;
        ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "userId" text;
        ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "teamName" text;
        ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "captainName" text;
        ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "phone" text;
        ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "amountBdt" integer DEFAULT 35;
        ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "refundStatus" text DEFAULT 'pending';
        ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "transactionId" text;
        ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "invoiceId" text;
        ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "paymentMethod" text;
        ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "senderNumber" text;
        ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "captainUid" text;
        ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "paymentId" text;
        ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "refundRef" text;
        ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "refundError" text;
        ALTER TABLE "not_hosted_teams" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp DEFAULT NOW();
      `)
    } finally {
      client.release()
    }
  } catch (err) {
    console.warn("[Database] ensureNotHostedTable error:", err)
  }
}

