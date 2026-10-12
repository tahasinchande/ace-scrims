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
  phone: text("phone"),
  role: text("role").notNull().default("user"), // user | moderator | admin
  banned: boolean("banned").notNull().default(false),
  isTrashed: boolean("isTrashed").notNull().default(false),
  deletedAt: timestamp("deletedAt"),
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
  mode: text("mode").notNull().default("BATTLE ROYALE"),
  startTime: text("startTime").notNull(), // e.g. "7:00 PM"
  scrimDate: date("scrimDate").notNull(),
  priceBdt: integer("priceBdt").notNull().default(35),
  prizePoolBdt: integer("prizePoolBdt").notNull().default(330),
  maxTeams: integer("maxTeams").notNull().default(12),
  bannerUrl: text("bannerUrl"),
  roomId: text("roomId"),
  roomPassword: text("roomPassword"),
  roomPublished: boolean("roomPublished").notNull().default(false),
  registrationOpen: boolean("registrationOpen").notNull().default(true),
  status: text("status").notNull().default("upcoming"), // upcoming | live | registration_closed | completed | not_hosted | deleted
  hidden: boolean("hidden").notNull().default(false),
  isTrashed: boolean("isTrashed").notNull().default(false),
  deletedAt: timestamp("deletedAt"),
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
  scrimDate: text("scrimDate"),
  transactionId: text("transactionId"),
  invoiceId: text("invoiceId"),
  teamLeaderImageUrl: text("teamLeaderImageUrl"),
  paymentNumber: text("paymentNumber"),
  teamMembersDriveLink: text("teamMembersDriveLink"),
  imageRequested: boolean("imageRequested").notNull().default(false),
  imageRequestedAt: timestamp("imageRequestedAt"),
  isArchived: boolean("isArchived").notNull().default(false),
  archivedAt: timestamp("archivedAt"),
  isTrashed: boolean("isTrashed").notNull().default(false),
  deletedAt: timestamp("deletedAt"),
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
  isTrashed: boolean("isTrashed").notNull().default(false),
  deletedAt: timestamp("deletedAt"),
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
  category: text("category").notNull().default("Top 3 Prize Pool"), // Top 3 Prize Pool | Top 3 Face Banner | MVP Face Banner | Overall Standing Banner | Complete Payment within 6 hours
  screenshotUrl: text("screenshotUrl"),
  imageUrls: jsonb("imageUrls"), // string[] for multiple images
  mvpPlayerName: text("mvpPlayerName"),
  mvpTeamName: text("mvpTeamName"),
  prizeStatus: text("prizeStatus").notNull().default("pending"), // pending | sent
  isTrashed: boolean("isTrashed").notNull().default(false),
  deletedAt: timestamp("deletedAt"),
  matchDate: date("matchDate").notNull(),
  publishedBy: text("publishedBy"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const reports = pgTable("reports", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  scrimId: text("scrimId"),
  reportType: text("reportType").notNull().default("General Report"),
  description: text("description").notNull(),
  proofUrl: text("proofUrl"),
  status: text("status").notNull().default("pending"), // pending | reviewed | resolved
  type: text("type"),
  whatsapp: text("whatsapp"),
  hackerUid: text("hackerUid"),
  hackerName: text("hackerName"),
  uid: text("uid"),
  name: text("name"),
  trxid: text("trxid"),
  bookingDetails: text("bookingDetails"),
  additionalInfo: text("additionalInfo"),
  imageUrl: text("imageUrl"),
  videoUrl: text("videoUrl"),
  isTrashed: boolean("isTrashed").notNull().default(false),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const tutorials = pgTable("tutorials", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  videoUrl: text("videoUrl").notNull(),
  description: text("description"),
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

export const chatMessages = pgTable("chat_messages", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  senderId: text("senderId").notNull(),
  senderName: text("senderName").notNull(),
  senderRole: text("senderRole").notNull().default("user"),
  message: text("message").notNull(),
  attachmentUrl: text("attachmentUrl"),
  attachmentType: text("attachmentType"), // image | file
  attachmentName: text("attachmentName"),
  readByStaff: boolean("readByStaff").notNull().default(false),
  readByUser: boolean("readByUser").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const notHostedTeams = pgTable("not_hosted_teams", {
  id: text("id").primaryKey(),
  scrimId: text("scrimId").notNull(),
  scrimTitle: text("scrimTitle").notNull(),
  scrimDate: text("scrimDate").notNull(),
  scrimTime: text("scrimTime").notNull(),
  bookingId: text("bookingId").notNull(),
  userId: text("userId").notNull(),
  teamName: text("teamName").notNull(),
  captainName: text("captainName").notNull(),
  captainUid: text("captainUid"),
  phone: text("phone").notNull(),
  paymentId: text("paymentId"),
  invoiceId: text("invoiceId"),
  transactionId: text("transactionId"),
  amountBdt: integer("amountBdt").notNull().default(35),
  paymentMethod: text("paymentMethod"),
  senderNumber: text("senderNumber"),
  refundStatus: text("refundStatus").notNull().default("pending"), // pending | refunded | failed
  refundRef: text("refundRef"),
  refundError: text("refundError"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const imageRequests = pgTable("image_requests", {
  id: text("id").primaryKey(),
  scrimId: text("scrimId").notNull(),
  scrimTitle: text("scrimTitle"),
  bookingId: text("bookingId").notNull(),
  userId: text("userId").notNull(),
  teamName: text("teamName").notNull(),
  captainName: text("captainName"),
  captainUid: text("captainUid"),
  status: text("status").notNull().default("pending"), // pending | submitted | approved | rejected
  requestType: text("requestType").notNull().default("MVP/Top 3 Image"),
  submittedTeamName: text("submittedTeamName"),
  submittedPlayerUid: text("submittedPlayerUid"),
  uploadedImageUrls: jsonb("uploadedImageUrls"),
  notes: text("notes"),
  requestedBy: text("requestedBy"),
  requestedAt: timestamp("requestedAt").notNull().defaultNow(),
  submittedAt: timestamp("submittedAt"),
  isTrashed: boolean("isTrashed").notNull().default(false),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// ── Types ───────────────────────────────────────────────────────────────

export type Scrim = typeof scrims.$inferSelect
export type Booking = typeof bookings.$inferSelect
export type Payment = typeof payments.$inferSelect
export type MatchResult = typeof results.$inferSelect
export type Report = typeof reports.$inferSelect
export type Tutorial = typeof tutorials.$inferSelect
export type Notification = typeof notifications.$inferSelect
export type AppUser = typeof user.$inferSelect
export type ChatMessage = typeof chatMessages.$inferSelect
export type NotHostedTeam = typeof notHostedTeams.$inferSelect
export type ImageRequest = typeof imageRequests.$inferSelect
