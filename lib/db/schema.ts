import {
  pgTable,
  text,
  boolean,
  timestamp,
  integer,
  date,
  jsonb,
} from "drizzle-orm/pg-core"

// ── Better Auth tables (column names must stay camelCase) ──────────────

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("user"), // user | moderator | admin
  banned: boolean("banned").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// ── App tables ──────────────────────────────────────────────────────────

export const scrims = pgTable("scrims", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  rules: text("rules"),
  notes: text("notes"),
  map: text("map").notNull().default("Bermuda"),
  mode: text("mode").notNull().default("Squad (4v4)"),
  startTime: text("startTime").notNull(), // e.g. "7:00 PM"
  scrimDate: date("scrimDate").notNull(),
  priceBdt: integer("priceBdt").notNull().default(50),
  prizePoolBdt: integer("prizePoolBdt").notNull().default(400),
  maxTeams: integer("maxTeams").notNull().default(12),
  bannerUrl: text("bannerUrl"),
  roomId: text("roomId"),
  roomPassword: text("roomPassword"),
  roomPublished: boolean("roomPublished").notNull().default(false),
  registrationOpen: boolean("registrationOpen").notNull().default(true),
  status: text("status").notNull().default("upcoming"), // upcoming | live | completed
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const bookings = pgTable("bookings", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  scrimId: text("scrimId").notNull(),
  status: text("status").notNull().default("pending"), // pending | confirmed | cancelled | failed
  teamName: text("teamName").notNull(),
  captainName: text("captainName").notNull(),
  captainUid: text("captainUid").notNull(),
  player2Name: text("player2Name").notNull(),
  player2Uid: text("player2Uid").notNull(),
  player3Name: text("player3Name").notNull(),
  player3Uid: text("player3Uid").notNull(),
  player4Name: text("player4Name").notNull(),
  player4Uid: text("player4Uid").notNull(),
  player5Name: text("player5Name"),
  player5Uid: text("player5Uid"),
  phone: text("phone").notNull(),
  discordTelegram: text("discordTelegram"),
  slotNumber: integer("slotNumber"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  bookingId: text("bookingId").notNull(),
  scrimId: text("scrimId").notNull(),
  invoiceId: text("invoiceId").unique(),
  transactionId: text("transactionId"),
  amountBdt: integer("amountBdt").notNull(),
  method: text("method"),
  senderNumber: text("senderNumber"),
  status: text("status").notNull().default("pending"), // pending | completed | failed | cancelled | refunded
  rawPayload: jsonb("rawPayload"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const results = pgTable("results", {
  id: text("id").primaryKey(),
  scrimId: text("scrimId").notNull(),
  winningTeam: text("winningTeam").notNull(),
  kills: integer("kills").notNull().default(0),
  prizeBdt: integer("prizeBdt").notNull().default(0),
  placement: integer("placement").notNull().default(1),
  screenshotUrl: text("screenshotUrl"),
  screenshotUrls: jsonb("screenshotUrls"),
  prizeStatus: text("prizeStatus").notNull().default("pending"), // pending | sent
  matchDate: date("matchDate").notNull(),
  publishedBy: text("publishedBy"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  type: text("type").notNull().default("announcement"),
  title: text("title").notNull(),
  body: text("body"),
  href: text("href"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const activityLogs = pgTable("activity_logs", {
  id: text("id").primaryKey(),
  actorId: text("actorId"),
  actorRole: text("actorRole"),
  action: text("action").notNull(),
  target: text("target"),
  meta: jsonb("meta"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// ── Types ───────────────────────────────────────────────────────────

export type Scrim = typeof scrims.$inferSelect
export type Booking = typeof bookings.$inferSelect
export type Payment = typeof payments.$inferSelect
export type MatchResult = typeof results.$inferSelect
export type Notification = typeof notifications.$inferSelect
export type AppUser = typeof user.$inferSelect
