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
function isBuildTimeContext(): boolean {
  return (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build"
  )
}

const SCHEMA_VERSION_KEY = "schema_migration_version"
const CURRENT_SCHEMA_VERSION = "v2026_11_21_creator_wallet_marquee_v2"

async function ensureSchema() {
  if (!connectionString || isBuildTimeContext()) return
  try {
    const client = await pool.connect()
    try {
      // Fast-path: 1 single lightweight query skips 110+ DDL round-trips when schema is already current
      try {
        const versionRes = await client.query(
          `SELECT "value" FROM "settings" WHERE "key" = $1 LIMIT 1`,
          [SCHEMA_VERSION_KEY]
        )
        if (versionRes.rows?.[0]?.value === CURRENT_SCHEMA_VERSION) {
          return
        }
      } catch {
        // settings table may not exist yet on brand-new databases; proceed with full DDL
      }

      const statements = [
        `ALTER TABLE "results" ADD COLUMN IF NOT EXISTS "category" text NOT NULL DEFAULT 'Top 3 Prize Pool'`,
        `ALTER TABLE "results" ADD COLUMN IF NOT EXISTS "imageUrls" jsonb`,
        `ALTER TABLE "results" ADD COLUMN IF NOT EXISTS "mvpPlayerName" text`,
        `ALTER TABLE "results" ADD COLUMN IF NOT EXISTS "mvpTeamName" text`,
        `ALTER TABLE "results" ADD COLUMN IF NOT EXISTS "isTrashed" boolean NOT NULL DEFAULT false`,
        `ALTER TABLE "results" ADD COLUMN IF NOT EXISTS "deletedAt" timestamp`,
        `ALTER TABLE "scrims" ADD COLUMN IF NOT EXISTS "category" text`,
        `ALTER TABLE "scrims" ADD COLUMN IF NOT EXISTS "hidden" boolean NOT NULL DEFAULT false`,
        `ALTER TABLE "scrims" ADD COLUMN IF NOT EXISTS "icebergEnabled" boolean NOT NULL DEFAULT false`,
        `ALTER TABLE "scrims" ADD COLUMN IF NOT EXISTS "icebergShowAllFilled" boolean NOT NULL DEFAULT false`,
        `ALTER TABLE "scrims" ADD COLUMN IF NOT EXISTS "icebergAmount" integer NOT NULL DEFAULT 7`,
        `ALTER TABLE "scrims" ADD COLUMN IF NOT EXISTS "icebergThreshold" integer NOT NULL DEFAULT 3`,
        `ALTER TABLE "scrims" ADD COLUMN IF NOT EXISTS "icebergStartRealCount" integer NOT NULL DEFAULT 0`,
        `ALTER TABLE "scrims" ADD COLUMN IF NOT EXISTS "deletedAt" timestamp`,
        `ALTER TABLE "scrims" ADD COLUMN IF NOT EXISTS "isTrashed" boolean NOT NULL DEFAULT false`,
        `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "scrimDate" text`,
        `UPDATE "bookings" SET "scrimDate" = COALESCE("scrimDate", ((("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka')::date)::text) WHERE "scrimDate" IS NULL`,
        `CREATE INDEX IF NOT EXISTS "idx_bookings_scrim_date_status" ON "bookings" ("scrimId", "scrimDate", "status")`,
        `CREATE INDEX IF NOT EXISTS "idx_bookings_user_date_status" ON "bookings" ("userId", "scrimDate", "status")`,
        `DROP INDEX IF EXISTS "uq_bookings_daily_confirmed_user"`,
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
        `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "videoUrls" jsonb`,
        `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "externalLinks" jsonb`,
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
        `ALTER TABLE "user_default_info" ADD COLUMN IF NOT EXISTS "teamName" text`,
        `ALTER TABLE "user_default_info" ADD COLUMN IF NOT EXISTS "teamTag" text`,
        `ALTER TABLE "user_default_info" ADD COLUMN IF NOT EXISTS "captainName" text`,
        `ALTER TABLE "user_default_info" ADD COLUMN IF NOT EXISTS "captainUid" text`,
        `ALTER TABLE "user_default_info" ADD COLUMN IF NOT EXISTS "phone" text`,
        `ALTER TABLE "user_default_info" ADD COLUMN IF NOT EXISTS "paymentMethod" text DEFAULT 'bKash'`,
        `ALTER TABLE "user_default_info" ADD COLUMN IF NOT EXISTS "paymentNumber" text`,
        `ALTER TABLE "user_default_info" ADD COLUMN IF NOT EXISTS "teamMembersDriveLink" text`,
        `ALTER TABLE "user_default_info" ADD COLUMN IF NOT EXISTS "teamLeaderImageUrl" text`,
        `ALTER TABLE "user_default_info" ADD COLUMN IF NOT EXISTS "createdAt" timestamp NOT NULL DEFAULT NOW()`,
        `ALTER TABLE "user_default_info" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp NOT NULL DEFAULT NOW()`,
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
        `UPDATE "scrims" SET "category" = 'Friday Special Blast' WHERE ("category" IS NULL OR "category" = '') AND ("slug" LIKE '%friday-special%' OR "title" ILIKE '%Friday Special%' OR "title" ILIKE '%Special Blast%')`,
        `UPDATE "scrims" SET "category" = 'Champion Rush' WHERE ("category" IS NULL OR "category" = '') AND ("slug" = '10-pm-champion-rush' OR "slug" = '3-pm-champion-rush' OR "slug" LIKE '%champion-rush%' OR "title" ILIKE '%Champion Rush%' OR "id" LIKE '%-cr')`,
        `UPDATE "scrims" SET "category" = 'Daily Scrims' WHERE ("category" IS NULL OR "category" = '') AND "slug" NOT LIKE '%champion-rush%' AND "slug" NOT LIKE '%friday-special%' AND "title" NOT ILIKE '%Champion Rush%' AND "title" NOT ILIKE '%Friday Special%'`,
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
        `ALTER TABLE "notices" ADD COLUMN IF NOT EXISTS "category" text NOT NULL DEFAULT 'General'`,
        `ALTER TABLE "notices" ADD COLUMN IF NOT EXISTS "priority" text NOT NULL DEFAULT 'normal'`,
        `ALTER TABLE "notices" ADD COLUMN IF NOT EXISTS "mediaUrl" text`,
        `ALTER TABLE "notices" ADD COLUMN IF NOT EXISTS "mediaType" text DEFAULT 'none'`,
        `ALTER TABLE "notices" ADD COLUMN IF NOT EXISTS "isPinned" boolean NOT NULL DEFAULT false`,
        `ALTER TABLE "notices" ADD COLUMN IF NOT EXISTS "isPublished" boolean NOT NULL DEFAULT true`,
        `ALTER TABLE "notices" ADD COLUMN IF NOT EXISTS "authorId" text`,
        `ALTER TABLE "notices" ADD COLUMN IF NOT EXISTS "authorName" text DEFAULT 'Ace Scrims Administration'`,
        `ALTER TABLE "notices" ADD COLUMN IF NOT EXISTS "createdAt" timestamp NOT NULL DEFAULT NOW()`,
        `ALTER TABLE "notices" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp NOT NULL DEFAULT NOW()`,
        `CREATE INDEX IF NOT EXISTS "idx_notices_published_created" ON "notices" ("isPublished", "isPinned", "createdAt")`,
        `CREATE TABLE IF NOT EXISTS "payout_methods" (
          "id" text PRIMARY KEY,
          "name" text NOT NULL,
          "code" text NOT NULL UNIQUE,
          "label" text NOT NULL,
          "description" text,
          "accentColor" text NOT NULL DEFAULT '#f97316',
          "requiresAccountNumber" boolean NOT NULL DEFAULT true,
          "isActive" boolean NOT NULL DEFAULT true,
          "sortOrder" integer NOT NULL DEFAULT 0,
          "createdAt" timestamp NOT NULL DEFAULT NOW(),
          "updatedAt" timestamp NOT NULL DEFAULT NOW()
        )`,
        `ALTER TABLE "payout_methods" ADD COLUMN IF NOT EXISTS "name" text`,
        `ALTER TABLE "payout_methods" ADD COLUMN IF NOT EXISTS "code" text`,
        `ALTER TABLE "payout_methods" ADD COLUMN IF NOT EXISTS "label" text`,
        `ALTER TABLE "payout_methods" ADD COLUMN IF NOT EXISTS "description" text`,
        `ALTER TABLE "payout_methods" ADD COLUMN IF NOT EXISTS "accentColor" text NOT NULL DEFAULT '#f97316'`,
        `ALTER TABLE "payout_methods" ADD COLUMN IF NOT EXISTS "requiresAccountNumber" boolean NOT NULL DEFAULT true`,
        `ALTER TABLE "payout_methods" ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT true`,
        `ALTER TABLE "payout_methods" ADD COLUMN IF NOT EXISTS "sortOrder" integer NOT NULL DEFAULT 0`,
        `ALTER TABLE "payout_methods" ADD COLUMN IF NOT EXISTS "createdAt" timestamp NOT NULL DEFAULT NOW()`,
        `ALTER TABLE "payout_methods" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp NOT NULL DEFAULT NOW()`,
        `UPDATE "payout_methods" SET "name" = COALESCE(NULLIF("name", ''), NULLIF("label", ''), NULLIF("code", ''), "id") WHERE "name" IS NULL OR "name" = ''`,
        `UPDATE "payout_methods" SET "code" = COALESCE(NULLIF("code", ''), NULLIF("name", ''), "id") WHERE "code" IS NULL OR "code" = ''`,
        `UPDATE "payout_methods" SET "label" = COALESCE(NULLIF("label", ''), NULLIF("name", ''), NULLIF("code", ''), "id") WHERE "label" IS NULL OR "label" = ''`,
        `DO $$
        DECLARE r record;
        BEGIN
          FOR r IN
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'payout_methods'
              AND is_nullable = 'NO'
              AND column_default IS NULL
              AND column_name NOT IN ('id', 'name', 'code', 'label', 'accentColor', 'requiresAccountNumber', 'isActive', 'sortOrder', 'createdAt', 'updatedAt')
          LOOP
            EXECUTE format('ALTER TABLE "payout_methods" ALTER COLUMN %I DROP NOT NULL', r.column_name);
          END LOOP;
        END $$`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "uq_payout_methods_code" ON "payout_methods" ("code")`,
        `INSERT INTO "payout_methods" ("id", "name", "code", "label", "description", "accentColor", "requiresAccountNumber", "isActive", "sortOrder")
         VALUES
          ('pm-bkash', 'bKash', 'bKash', 'bKash Personal', 'Mobile financial service personal account', '#E2136E', true, true, 1),
          ('pm-nagad', 'Nagad', 'Nagad', 'Nagad Personal', 'Mobile financial service personal account', '#F7941D', true, true, 2),
          ('pm-rocket', 'Rocket', 'Rocket', 'Rocket Personal', 'Dutch-Bangla Mobile Banking (Rocket)', '#8C3494', true, true, 3),
          ('pm-tap', 'Tap', 'Tap', 'Tap Personal', 'Trust Axiata Pay digital wallet', '#00A19D', true, true, 4),
          ('pm-balance', 'Balance', 'Balance', 'Ace Scrims Wallet', 'Instant wallet credit for 1-click scrim booking', '#10B981', false, true, 5)
         ON CONFLICT DO NOTHING`,
        `CREATE TABLE IF NOT EXISTS "email_templates" (
          "id" text PRIMARY KEY,
          "purposeKey" text NOT NULL UNIQUE,
          "label" text NOT NULL,
          "description" text,
          "category" text NOT NULL DEFAULT 'system',
          "isEnabled" boolean NOT NULL DEFAULT true,
          "isCore" boolean NOT NULL DEFAULT false,
          "format" text NOT NULL DEFAULT 'html',
          "subject" text NOT NULL,
          "preheader" text,
          "bodyHtml" text NOT NULL,
          "bodyText" text NOT NULL,
          "ctaText" text,
          "ctaUrl" text,
          "mediaItems" jsonb NOT NULL DEFAULT '[]'::jsonb,
          "variablesHint" jsonb,
          "updatedBy" text,
          "createdAt" timestamp NOT NULL DEFAULT NOW(),
          "updatedAt" timestamp NOT NULL DEFAULT NOW()
        )`,
        `ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "purposeKey" text`,
        `ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "label" text NOT NULL DEFAULT ''`,
        `ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "description" text`,
        `ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "category" text NOT NULL DEFAULT 'system'`,
        `ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "isEnabled" boolean NOT NULL DEFAULT true`,
        `ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "isCore" boolean NOT NULL DEFAULT false`,
        `ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "format" text NOT NULL DEFAULT 'html'`,
        `ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "subject" text NOT NULL DEFAULT ''`,
        `ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "preheader" text`,
        `ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "bodyHtml" text NOT NULL DEFAULT ''`,
        `ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "bodyText" text NOT NULL DEFAULT ''`,
        `ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "ctaText" text`,
        `ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "ctaUrl" text`,
        `ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "mediaItems" jsonb NOT NULL DEFAULT '[]'::jsonb`,
        `ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "variablesHint" jsonb`,
        `ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "updatedBy" text`,
        `ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "createdAt" timestamp NOT NULL DEFAULT NOW()`,
        `ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp NOT NULL DEFAULT NOW()`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "uq_email_templates_purpose_key" ON "email_templates" ("purposeKey")`,
        `CREATE TABLE IF NOT EXISTS "chat_sessions" (
          "userId" text PRIMARY KEY,
          "mode" text NOT NULL DEFAULT 'ai',
          "escalatedAt" timestamp,
          "takenOverBy" text,
          "takenOverAt" timestamp,
          "lastAiReplyAt" timestamp,
          "createdAt" timestamp NOT NULL DEFAULT NOW(),
          "updatedAt" timestamp NOT NULL DEFAULT NOW()
        )`,
        `ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "mode" text NOT NULL DEFAULT 'ai'`,
        `ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "escalatedAt" timestamp`,
        `ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "takenOverBy" text`,
        `ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "takenOverAt" timestamp`,
        `ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "lastAiReplyAt" timestamp`,
        `ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "createdAt" timestamp NOT NULL DEFAULT NOW()`,
        `ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp NOT NULL DEFAULT NOW()`,
        `CREATE TABLE IF NOT EXISTS "chat_moderation_logs" (
          "id" text PRIMARY KEY,
          "userId" text NOT NULL,
          "userName" text,
          "userEmail" text,
          "messageContent" text NOT NULL DEFAULT '',
          "violationCategory" text NOT NULL DEFAULT 'abusive',
          "reason" text NOT NULL DEFAULT '',
          "confidence" integer NOT NULL DEFAULT 0,
          "detectorSource" text NOT NULL DEFAULT 'regex',
          "actionTaken" text NOT NULL DEFAULT 'permanent_ban',
          "isResolved" boolean NOT NULL DEFAULT false,
          "resolvedBy" text,
          "resolvedAt" timestamp,
          "createdAt" timestamp NOT NULL DEFAULT NOW()
        )`,
        `ALTER TABLE "chat_moderation_logs" ADD COLUMN IF NOT EXISTS "userName" text`,
        `ALTER TABLE "chat_moderation_logs" ADD COLUMN IF NOT EXISTS "userEmail" text`,
        `ALTER TABLE "chat_moderation_logs" ADD COLUMN IF NOT EXISTS "messageContent" text NOT NULL DEFAULT ''`,
        `ALTER TABLE "chat_moderation_logs" ADD COLUMN IF NOT EXISTS "violationCategory" text NOT NULL DEFAULT 'abusive'`,
        `ALTER TABLE "chat_moderation_logs" ADD COLUMN IF NOT EXISTS "reason" text NOT NULL DEFAULT ''`,
        `ALTER TABLE "chat_moderation_logs" ADD COLUMN IF NOT EXISTS "confidence" integer NOT NULL DEFAULT 0`,
        `ALTER TABLE "chat_moderation_logs" ADD COLUMN IF NOT EXISTS "detectorSource" text NOT NULL DEFAULT 'regex'`,
        `ALTER TABLE "chat_moderation_logs" ADD COLUMN IF NOT EXISTS "actionTaken" text NOT NULL DEFAULT 'permanent_ban'`,
        `ALTER TABLE "chat_moderation_logs" ADD COLUMN IF NOT EXISTS "isResolved" boolean NOT NULL DEFAULT false`,
        `ALTER TABLE "chat_moderation_logs" ADD COLUMN IF NOT EXISTS "resolvedBy" text`,
        `ALTER TABLE "chat_moderation_logs" ADD COLUMN IF NOT EXISTS "resolvedAt" timestamp`,
        `ALTER TABLE "chat_moderation_logs" ADD COLUMN IF NOT EXISTS "createdAt" timestamp NOT NULL DEFAULT NOW()`,
        `DO $$
        DECLARE r record;
        BEGIN
          FOR r IN
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'chat_moderation_logs'
              AND is_nullable = 'NO'
              AND column_default IS NULL
              AND column_name NOT IN ('id', 'userId', 'messageContent', 'violationCategory', 'reason', 'confidence', 'detectorSource', 'actionTaken', 'isResolved', 'createdAt')
          LOOP
            EXECUTE format('ALTER TABLE "chat_moderation_logs" ALTER COLUMN %I DROP NOT NULL', r.column_name);
          END LOOP;
        END $$`,
        `CREATE TABLE IF NOT EXISTS "email_logs" (
          "id" text PRIMARY KEY,
          "recipientEmail" text NOT NULL,
          "purposeKey" text,
          "subject" text NOT NULL,
          "status" text NOT NULL DEFAULT 'sent',
          "provider" text,
          "error" text,
          "createdAt" timestamp NOT NULL DEFAULT NOW()
        )`,
        `ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "purposeKey" text`,
        `ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'sent'`,
        `ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "provider" text`,
        `ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "error" text`,
        `ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "createdAt" timestamp NOT NULL DEFAULT NOW()`,
        `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "referralCode" text`,
        `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "referredByCode" text`,
        `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "referredByUserId" text`,
        `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "referralType" text`,
        `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "referralLockedAt" timestamp`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "uq_user_referral_code" ON "user" ("referralCode") WHERE "referralCode" IS NOT NULL`,
        `CREATE TABLE IF NOT EXISTS "creator_applications" (
          "id" text PRIMARY KEY,
          "userId" text NOT NULL,
          "creatorName" text NOT NULL,
          "platform" text NOT NULL,
          "channelUrl" text NOT NULL,
          "secondaryLinks" jsonb NOT NULL DEFAULT '[]'::jsonb,
          "followerCount" text NOT NULL,
          "averageViews" text,
          "whatsapp" text NOT NULL,
          "notes" text,
          "status" text NOT NULL DEFAULT 'pending',
          "referralCode" text UNIQUE,
          "adminNote" text,
          "reviewedBy" text,
          "reviewedAt" timestamp,
          "createdAt" timestamp NOT NULL DEFAULT NOW(),
          "updatedAt" timestamp NOT NULL DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS "idx_creator_applications_user" ON "creator_applications" ("userId", "status")`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "uq_creator_applications_referral_code" ON "creator_applications" ("referralCode") WHERE "referralCode" IS NOT NULL`,
        `CREATE TABLE IF NOT EXISTS "referrals" (
          "id" text PRIMARY KEY,
          "referrerUserId" text NOT NULL,
          "referredUserId" text NOT NULL UNIQUE,
          "referralCode" text NOT NULL,
          "referralType" text NOT NULL,
          "creatorApplicationId" text,
          "qualifyingScrimsCount" integer NOT NULL DEFAULT 0,
          "requiredScrimsCount" integer NOT NULL DEFAULT 1,
          "status" text NOT NULL DEFAULT 'pending',
          "rewardAmountBdt" integer NOT NULL DEFAULT 0,
          "rewardModeUsed" text,
          "rewardedAt" timestamp,
          "walletTxId" text,
          "createdAt" timestamp NOT NULL DEFAULT NOW(),
          "updatedAt" timestamp NOT NULL DEFAULT NOW()
        )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "uq_referrals_referred_user" ON "referrals" ("referredUserId")`,
        `CREATE INDEX IF NOT EXISTS "idx_referrals_referrer" ON "referrals" ("referrerUserId", "status")`,
        `CREATE TABLE IF NOT EXISTS "referral_qualifying_bookings" (
          "id" text PRIMARY KEY,
          "referralId" text NOT NULL,
          "bookingId" text NOT NULL UNIQUE,
          "scrimId" text NOT NULL,
          "amountBdt" integer NOT NULL DEFAULT 0,
          "createdAt" timestamp NOT NULL DEFAULT NOW()
        )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "uq_ref_qualifying_booking" ON "referral_qualifying_bookings" ("bookingId")`,
        `CREATE TABLE IF NOT EXISTS "partnership_items" (
          "id" text PRIMARY KEY,
          "partnerName" text NOT NULL,
          "headline" text NOT NULL,
          "tagline" text,
          "logoUrl" text,
          "linkUrl" text,
          "badgeText" text,
          "isActive" boolean NOT NULL DEFAULT true,
          "sortOrder" integer NOT NULL DEFAULT 0,
          "createdAt" timestamp NOT NULL DEFAULT NOW(),
          "updatedAt" timestamp NOT NULL DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS "idx_partnership_items_active_sort" ON "partnership_items" ("isActive", "sortOrder", "createdAt")`,
        `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "creatorBalance" integer NOT NULL DEFAULT 0`,
        `ALTER TABLE "referrals" ADD COLUMN IF NOT EXISTS "qualifyingSpendBdt" integer NOT NULL DEFAULT 0`,
        `ALTER TABLE "referrals" ADD COLUMN IF NOT EXISTS "requiredSpendBdt" integer NOT NULL DEFAULT 0`,
        `ALTER TABLE "referrals" ADD COLUMN IF NOT EXISTS "rewardRecipient" text NOT NULL DEFAULT 'referrer'`,
        `ALTER TABLE "referrals" ADD COLUMN IF NOT EXISTS "creatorSignupPaidBdt" integer NOT NULL DEFAULT 0`,
        `ALTER TABLE "referrals" ADD COLUMN IF NOT EXISTS "creatorSignupPaidAt" timestamp`,
        `ALTER TABLE "referrals" ADD COLUMN IF NOT EXISTS "creatorWalletTxId" text`,
        `CREATE TABLE IF NOT EXISTS "creator_wallet_transactions" (
          "id" text PRIMARY KEY,
          "userId" text NOT NULL,
          "creatorApplicationId" text,
          "type" text NOT NULL,
          "amountBdt" integer NOT NULL,
          "balanceBefore" integer NOT NULL DEFAULT 0,
          "balanceAfter" integer NOT NULL DEFAULT 0,
          "description" text,
          "referenceId" text,
          "status" text NOT NULL DEFAULT 'completed',
          "createdAt" timestamp NOT NULL DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS "idx_creator_wallet_user_created" ON "creator_wallet_transactions" ("userId", "createdAt")`,
        `CREATE TABLE IF NOT EXISTS "creator_withdrawals" (
          "id" text PRIMARY KEY,
          "userId" text NOT NULL,
          "creatorApplicationId" text,
          "amountBdt" integer NOT NULL,
          "whatsapp" text NOT NULL,
          "payoutMethod" text NOT NULL,
          "payoutAccount" text,
          "status" text NOT NULL DEFAULT 'pending',
          "adminNote" text,
          "processedBy" text,
          "processedAt" timestamp,
          "walletTxId" text,
          "createdAt" timestamp NOT NULL DEFAULT NOW(),
          "updatedAt" timestamp NOT NULL DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS "idx_creator_withdrawals_user_status" ON "creator_withdrawals" ("userId", "status", "createdAt")`
      ]

      // Execute DDL in compact multi-statement batches to minimize remote Neon round-trips
      const CHUNK_SIZE = 15
      for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
        const chunk = statements.slice(i, i + CHUNK_SIZE)
        try {
          await client.query(chunk.join(";\n"))
        } catch {
          // If any statement in a batch fails, fall back to executing that chunk individually
          for (const stmt of chunk) {
            try {
              await client.query(stmt)
            } catch (stmtErr) {
              console.warn("[Database] ensureSchema statement failed (continuing):", stmtErr)
            }
          }
        }
      }

      // Stamp schema version so future cold starts return in 1 query (~150ms)
      try {
        await client.query(
          `INSERT INTO "settings" ("key", "value", "updatedAt")
           VALUES ($1, $2, NOW())
           ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = NOW()`,
          [SCHEMA_VERSION_KEY, CURRENT_SCHEMA_VERSION]
        )
      } catch (stampErr) {
        console.warn("[Database] Failed stamping schema version:", stampErr)
      }
    } finally {
      client.release()
    }
  } catch (err) {
    console.warn("[Database] ensureSchema connection error:", err)
  }
}

let schemaReadyPromise: Promise<void> | null = null

/**
 * Lazily ensures schema additions once per server runtime, avoiding top-level
 * database connections during Next.js static analysis and production build steps.
 */
export async function ensureSchemaReady(): Promise<void> {
  if (!connectionString || isBuildTimeContext()) return
  if (!schemaReadyPromise) {
    schemaReadyPromise = ensureSchema().catch((err) => {
      schemaReadyPromise = null
      console.warn("[Database] ensureSchemaReady failed:", err)
    })
  }
  await schemaReadyPromise
}

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

