import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

function getDatabaseConnectionString(): string {
  let url = (process.env.DATABASE_URL || "").trim()
  if (!url) {
    console.warn("[Database] DATABASE_URL is not set.")
    return ""
  }
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
        `ALTER TABLE "scrims" ADD COLUMN IF NOT EXISTS "category" text`,
        `ALTER TABLE "scrims" ADD COLUMN IF NOT EXISTS "hidden" boolean NOT NULL DEFAULT false`,
        `ALTER TABLE "scrims" ADD COLUMN IF NOT EXISTS "deletedAt" timestamp`,
        `ALTER TABLE "scrims" ADD COLUMN IF NOT EXISTS "isTrashed" boolean NOT NULL DEFAULT false`,
        `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "scrimDate" text`,
        `UPDATE "bookings" SET "scrimDate" = COALESCE("scrimDate", (("createdAt" AT TIME ZONE 'Asia/Dhaka')::date)::text) WHERE "scrimDate" IS NULL`,
        `CREATE INDEX IF NOT EXISTS "idx_bookings_scrim_date_status" ON "bookings" ("scrimId", "scrimDate", "status")`,
        `CREATE INDEX IF NOT EXISTS "idx_bookings_user_date_status" ON "bookings" ("userId", "scrimDate", "status")`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "uq_bookings_confirmed_user" ON "bookings" ("scrimId", "scrimDate", "userId") WHERE "status" = 'confirmed' AND "isTrashed" = false AND "isArchived" = false`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "uq_bookings_confirmed_team" ON "bookings" ("scrimId", "scrimDate", LOWER(TRIM("teamName"))) WHERE "status" = 'confirmed' AND "isTrashed" = false AND "isArchived" = false`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "uq_bookings_confirmed_uid" ON "bookings" ("scrimId", "scrimDate", TRIM("captainUid")) WHERE "status" = 'confirmed' AND "isTrashed" = false AND "isArchived" = false`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "uq_bookings_confirmed_slot" ON "bookings" ("scrimId", "scrimDate", "slotNumber") WHERE "status" = 'confirmed' AND "isTrashed" = false AND "isArchived" = false AND "slotNumber" IS NOT NULL`,
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
        `ALTER TABLE "image_requests" ADD COLUMN IF NOT EXISTS "mvpPlayerName" text`,
        `ALTER TABLE "image_requests" ADD COLUMN IF NOT EXISTS "submittedPlayerName" text`,
        `ALTER TABLE "image_requests" ADD COLUMN IF NOT EXISTS "scrimDate" text`,
        `ALTER TABLE "image_requests" ADD COLUMN IF NOT EXISTS "isTrashed" boolean NOT NULL DEFAULT false`,
        `ALTER TABLE "image_requests" ADD COLUMN IF NOT EXISTS "deletedAt" timestamp`,
        `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "isTrashed" boolean NOT NULL DEFAULT false`,
        `ALTER TABLE "scrims" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'Daily Scrims'`,
        `ALTER TABLE "scrims" ADD COLUMN IF NOT EXISTS "isTrashed" boolean NOT NULL DEFAULT false`,
        `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "paymentMethod" text DEFAULT 'bKash'`,
        `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "balance" integer NOT NULL DEFAULT 0`,
        `CREATE TABLE IF NOT EXISTS "user_default_info" (
          "id" text PRIMARY KEY,
          "userId" text NOT NULL UNIQUE REFERENCES "user"("id") ON DELETE CASCADE,
          "teamName" text,
          "teamTag" text,
          "captainName" text,
          "captainUid" text,
          "phone" text,
          "paymentMethod" text DEFAULT 'bKash',
          "paymentNumber" text,
          "teamMembersDriveLink" text,
          "teamLeaderImageUrl" text,
          "createdAt" timestamp NOT NULL DEFAULT NOW(),
          "updatedAt" timestamp NOT NULL DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS "idx_user_default_info_user_id" ON "user_default_info" ("userId")`,
        `CREATE TABLE IF NOT EXISTS "wallet_transactions" (
          "id" text PRIMARY KEY,
          "userId" text NOT NULL,
          "type" text NOT NULL,
          "amountBdt" integer NOT NULL,
          "balanceBefore" integer NOT NULL DEFAULT 0,
          "balanceAfter" integer NOT NULL DEFAULT 0,
          "description" text,
          "referenceId" text,
          "status" text NOT NULL DEFAULT 'completed',
          "createdAt" timestamp NOT NULL DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS "idx_wallet_user_created" ON "wallet_transactions" ("userId", "createdAt")`,
        `DELETE FROM "settings" WHERE "key" = 'support_phone'`,
        `INSERT INTO "settings" ("key", "value", "updatedAt") VALUES ('champion_rush_3pm_whatsapp_url', 'https://whatsapp.com/channel/0029Vb7Bq9w42DcT1O2b0s3V', NOW()) ON CONFLICT ("key") DO NOTHING`,
        `UPDATE "scrims" SET "category" = 'Friday Special Blast' WHERE "slug" LIKE '%friday-special%' OR "title" ILIKE '%Friday Special%' OR "title" ILIKE '%Special Blast%'`,
        `UPDATE "scrims" SET "category" = 'Champion Rush', "map" = 'Champion Mode (Max 8 Matches)', "priceBdt" = 50, "prizePoolBdt" = 480 WHERE "slug" = '10-pm-champion-rush' OR "slug" = '3-pm-champion-rush' OR "slug" LIKE '%champion-rush%' OR "title" ILIKE '%Champion Rush%' OR "id" LIKE '%-cr'`,
        `UPDATE "scrims" SET "category" = 'Daily Scrims' WHERE ("category" IS NULL OR "category" = '') AND "slug" NOT LIKE '%champion-rush%' AND "slug" NOT LIKE '%friday-special%' AND "title" NOT ILIKE '%Champion Rush%' AND "title" NOT ILIKE '%Friday Special%'`,
        `UPDATE "scrims" SET "priceBdt" = 35, "prizePoolBdt" = 330 WHERE ("id" LIKE 'scrim-%' OR "slug" NOT LIKE '%champion-rush%') AND "slug" NOT LIKE '%champion-rush%' AND "slug" NOT LIKE '%friday-special%' AND "id" NOT LIKE '%-cr' AND "id" NOT LIKE '%-fri%' AND "title" NOT ILIKE '%Champion Rush%' AND "title" NOT ILIKE '%Friday Special%'`,
        `UPDATE "scrims" SET "bannerUrl" = CASE "slug"
          WHEN '3-pm-scrim-room-1' THEN '/images/scrim-1.jpg'
          WHEN '3-pm-scrim-room-2' THEN '/images/scrim-2.jpg'
          WHEN '4-pm-scrim-room-1' THEN '/images/scrim-3.jpg'
          WHEN '4-pm-scrim-room-2' THEN '/images/scrim-4.jpg'
          WHEN '5-pm-scrim-room-1' THEN '/images/scrim-5.jpg'
          WHEN '5-pm-scrim-room-2' THEN '/images/scrim-6.jpg'
          WHEN '7-pm-scrim-room-1' THEN '/images/scrim-7.jpg'
          WHEN '7-pm-scrim-room-2' THEN '/images/scrim-8.jpg'
          WHEN '8-pm-scrim-room-1' THEN '/images/scrim-9.jpg'
          WHEN '8-pm-scrim-room-2' THEN '/images/scrim-10.jpg'
          WHEN '9-pm-scrim-room-1' THEN '/images/scrim-11.jpg'
          WHEN '9-pm-scrim-room-2' THEN '/images/scrim-12.jpg'
          WHEN '10-pm-scrim-room-1' THEN '/images/bermuda.jpg'
          WHEN '10-pm-scrim-room-2' THEN '/images/purgatory.jpg'
          WHEN '11-pm-scrim-room-1' THEN '/images/kalahari.jpg'
          WHEN '11-pm-scrim-room-2' THEN '/images/nexterra.jpg'
          WHEN '12-am-scrim-room-1' THEN '/images/alpine.jpg'
          WHEN '12-am-scrim-room-2' THEN '/images/scrim_squad_clash_1786956645507.jpg'
          WHEN '3-pm-champion-rush' THEN '/images/scrim_cyber_arena_1786956594944.jpg'
          WHEN '10-pm-champion-rush' THEN '/images/sakura-wallpaper.jpg'
          ELSE "bannerUrl"
        END WHERE "slug" IN ('3-pm-scrim-room-1', '3-pm-scrim-room-2', '4-pm-scrim-room-1', '4-pm-scrim-room-2', '5-pm-scrim-room-1', '5-pm-scrim-room-2', '7-pm-scrim-room-1', '7-pm-scrim-room-2', '8-pm-scrim-room-1', '8-pm-scrim-room-2', '9-pm-scrim-room-1', '9-pm-scrim-room-2', '10-pm-scrim-room-1', '10-pm-scrim-room-2', '11-pm-scrim-room-1', '11-pm-scrim-room-2', '12-am-scrim-room-1', '12-am-scrim-room-2', '3-pm-champion-rush', '10-pm-champion-rush')`,
        `CREATE TABLE IF NOT EXISTS "notices" (
          "id" text PRIMARY KEY,
          "title" text NOT NULL,
          "content" text NOT NULL,
          "category" text NOT NULL DEFAULT 'General',
          "priority" text NOT NULL DEFAULT 'normal',
          "mediaUrl" text,
          "mediaType" text DEFAULT 'none',
          "isPinned" boolean NOT NULL DEFAULT false,
          "isPublished" boolean NOT NULL DEFAULT true,
          "authorId" text,
          "authorName" text DEFAULT 'Ace Scrims Administration',
          "createdAt" timestamp NOT NULL DEFAULT NOW(),
          "updatedAt" timestamp NOT NULL DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS "idx_notices_published_created" ON "notices" ("isPublished", "isPinned", "createdAt")`
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

