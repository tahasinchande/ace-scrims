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
  role: text("role").notNull().default("user"), // user | moderator | admin | owner
  balance: integer("balance").notNull().default(0),
  creatorBalance: integer("creatorBalance").notNull().default(0),
  referralCode: text("referralCode").unique(),
  referredByCode: text("referredByCode"),
  referredByUserId: text("referredByUserId"),
  referralType: text("referralType"), // creator | user
  referralLockedAt: timestamp("referralLockedAt"),
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
  category: text("category"),
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
  icebergEnabled: boolean("icebergEnabled").notNull().default(false),
  icebergShowAllFilled: boolean("icebergShowAllFilled").notNull().default(false),
  icebergAmount: integer("icebergAmount").notNull().default(7),
  icebergThreshold: integer("icebergThreshold").notNull().default(3),
  icebergStartRealCount: integer("icebergStartRealCount").notNull().default(0),
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
  paymentMethod: text("paymentMethod"),
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
  videoUrls: jsonb("videoUrls").$type<string[]>(),
  externalLinks: jsonb("externalLinks").$type<string[]>(),
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
  replyToId: text("replyToId"),
  reactions: text("reactions"),
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
  mvpPlayerName: text("mvpPlayerName"),
  scrimDate: text("scrimDate"),
  submittedTeamName: text("submittedTeamName"),
  submittedPlayerUid: text("submittedPlayerUid"),
  submittedPlayerName: text("submittedPlayerName"),
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

export const walletTransactions = pgTable("wallet_transactions", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  type: text("type").notNull(), // deposit | scrim_booking | refund | adjustment
  amountBdt: integer("amountBdt").notNull(),
  balanceBefore: integer("balanceBefore").notNull().default(0),
  balanceAfter: integer("balanceAfter").notNull().default(0),
  description: text("description"),
  referenceId: text("referenceId"), // invoiceId, bookingId, paymentId
  status: text("status").notNull().default("completed"), // completed | pending | failed
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const userDefaultInfo = pgTable("user_default_info", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  teamName: text("teamName"),
  teamTag: text("teamTag"),
  captainName: text("captainName"),
  captainUid: text("captainUid"),
  phone: text("phone"),
  paymentMethod: text("paymentMethod").default("bKash"),
  paymentNumber: text("paymentNumber"),
  teamMembersDriveLink: text("teamMembersDriveLink"),
  teamLeaderImageUrl: text("teamLeaderImageUrl"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const notices = pgTable("notices", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull().default("General"), // General | Announcement | Tournament | Rules | Urgent | Maintenance
  priority: text("priority").notNull().default("normal"), // normal | important | urgent
  mediaUrl: text("mediaUrl"),
  mediaType: text("mediaType").default("none"), // image | video | none
  isPinned: boolean("isPinned").notNull().default(false),
  isPublished: boolean("isPublished").notNull().default(true),
  authorId: text("authorId"),
  authorName: text("authorName").default("Ace Scrims Administration"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const payoutMethods = pgTable("payout_methods", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  label: text("label").notNull(),
  description: text("description"),
  accentColor: text("accentColor").notNull().default("#f97316"),
  requiresAccountNumber: boolean("requiresAccountNumber").notNull().default(true),
  isActive: boolean("isActive").notNull().default(true),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export type EmailTemplateMediaItem = {
  id?: string
  url: string
  type: "image" | "video" | "link"
  name?: string
}

export const emailTemplates = pgTable("email_templates", {
  id: text("id").primaryKey(),
  purposeKey: text("purposeKey").notNull().unique(),
  label: text("label").notNull(),
  description: text("description"),
  category: text("category").notNull().default("system"), // system | custom
  isEnabled: boolean("isEnabled").notNull().default(true),
  isCore: boolean("isCore").notNull().default(false),
  format: text("format").notNull().default("html"), // html | text
  subject: text("subject").notNull(),
  preheader: text("preheader"),
  bodyHtml: text("bodyHtml").notNull(),
  bodyText: text("bodyText").notNull(),
  ctaText: text("ctaText"),
  ctaUrl: text("ctaUrl"),
  mediaItems: jsonb("mediaItems").$type<EmailTemplateMediaItem[]>().notNull().default([]),
  variablesHint: jsonb("variablesHint").$type<string | string[] | null>(),
  updatedBy: text("updatedBy"),
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
export type WalletTransaction = typeof walletTransactions.$inferSelect
export type UserDefaultInfo = typeof userDefaultInfo.$inferSelect
export type Notice = typeof notices.$inferSelect
export type PayoutMethod = typeof payoutMethods.$inferSelect
export type EmailTemplate = typeof emailTemplates.$inferSelect

export const chatSessions = pgTable("chat_sessions", {
  userId: text("userId").primaryKey(),
  mode: text("mode").notNull().default("ai"), // ai | human
  escalatedAt: timestamp("escalatedAt"),
  takenOverBy: text("takenOverBy"),
  takenOverAt: timestamp("takenOverAt"),
  lastAiReplyAt: timestamp("lastAiReplyAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const chatModerationLogs = pgTable("chat_moderation_logs", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  userName: text("userName"),
  userEmail: text("userEmail"),
  messageContent: text("messageContent").notNull(),
  violationCategory: text("violationCategory").notNull(),
  reason: text("reason").notNull(),
  confidence: integer("confidence").notNull().default(0),
  detectorSource: text("detectorSource").notNull(),
  actionTaken: text("actionTaken").notNull(),
  isResolved: boolean("isResolved").notNull().default(false),
  resolvedBy: text("resolvedBy"),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const emailLogs = pgTable("email_logs", {
  id: text("id").primaryKey(),
  recipientEmail: text("recipientEmail").notNull(),
  purposeKey: text("purposeKey"),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("sent"),
  provider: text("provider"),
  error: text("error"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const creatorApplications = pgTable("creator_applications", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  creatorName: text("creatorName").notNull(),
  platform: text("platform").notNull(), // YouTube | Facebook | TikTok | Instagram | Twitch | Other
  channelUrl: text("channelUrl").notNull(),
  secondaryLinks: jsonb("secondaryLinks").$type<string[]>().notNull().default([]),
  followerCount: text("followerCount").notNull(),
  averageViews: text("averageViews"),
  whatsapp: text("whatsapp").notNull(),
  notes: text("notes"),
  requestedReferralCode: text("requestedReferralCode"),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  referralCode: text("referralCode").unique(),
  adminNote: text("adminNote"),
  reviewedBy: text("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const referrals = pgTable("referrals", {
  id: text("id").primaryKey(),
  referrerUserId: text("referrerUserId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  referredUserId: text("referredUserId")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  referralCode: text("referralCode").notNull(),
  referralType: text("referralType").notNull(), // creator | user
  creatorApplicationId: text("creatorApplicationId"),
  qualifyingScrimsCount: integer("qualifyingScrimsCount").notNull().default(0),
  requiredScrimsCount: integer("requiredScrimsCount").notNull().default(1),
  qualifyingSpendBdt: integer("qualifyingSpendBdt").notNull().default(0),
  requiredSpendBdt: integer("requiredSpendBdt").notNull().default(0),
  rewardRecipient: text("rewardRecipient").notNull().default("referrer"), // referrer | referred_user
  creatorSignupPaidBdt: integer("creatorSignupPaidBdt").notNull().default(0),
  creatorSignupPaidAt: timestamp("creatorSignupPaidAt"),
  creatorWalletTxId: text("creatorWalletTxId"),
  status: text("status").notNull().default("pending"), // pending | rewarded
  rewardAmountBdt: integer("rewardAmountBdt").notNull().default(0),
  rewardModeUsed: text("rewardModeUsed"), // fixed | random
  rewardedAt: timestamp("rewardedAt"),
  walletTxId: text("walletTxId"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const referralQualifyingBookings = pgTable("referral_qualifying_bookings", {
  id: text("id").primaryKey(),
  referralId: text("referralId")
    .notNull()
    .references(() => referrals.id, { onDelete: "cascade" }),
  bookingId: text("bookingId")
    .notNull()
    .unique()
    .references(() => bookings.id, { onDelete: "cascade" }),
  scrimId: text("scrimId").notNull(),
  amountBdt: integer("amountBdt").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const partnershipItems = pgTable("partnership_items", {
  id: text("id").primaryKey(),
  partnerName: text("partnerName").notNull(),
  headline: text("headline").notNull(),
  tagline: text("tagline"),
  logoUrl: text("logoUrl"),
  linkUrl: text("linkUrl"),
  badgeText: text("badgeText"),
  isActive: boolean("isActive").notNull().default(true),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const creatorWalletTransactions = pgTable("creator_wallet_transactions", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  creatorApplicationId: text("creatorApplicationId"),
  type: text("type").notNull(), // signup_payout | withdrawal | withdrawal_refund | adjustment
  amountBdt: integer("amountBdt").notNull(),
  balanceBefore: integer("balanceBefore").notNull().default(0),
  balanceAfter: integer("balanceAfter").notNull().default(0),
  description: text("description"),
  referenceId: text("referenceId"),
  status: text("status").notNull().default("completed"), // completed | pending | rejected
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const creatorWithdrawals = pgTable("creator_withdrawals", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  creatorApplicationId: text("creatorApplicationId"),
  amountBdt: integer("amountBdt").notNull(),
  whatsapp: text("whatsapp").notNull(),
  payoutMethod: text("payoutMethod").notNull(),
  payoutAccount: text("payoutAccount"),
  status: text("status").notNull().default("pending"), // pending | paid | rejected
  adminNote: text("adminNote"),
  processedBy: text("processedBy"),
  processedAt: timestamp("processedAt"),
  walletTxId: text("walletTxId"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export type ChatSession = typeof chatSessions.$inferSelect
export type ChatModerationLog = typeof chatModerationLogs.$inferSelect
export type EmailLog = typeof emailLogs.$inferSelect
export type CreatorApplication = typeof creatorApplications.$inferSelect
export type Referral = typeof referrals.$inferSelect
export type ReferralQualifyingBooking = typeof referralQualifyingBookings.$inferSelect
export type PartnershipItem = typeof partnershipItems.$inferSelect
export type CreatorWalletTransaction = typeof creatorWalletTransactions.$inferSelect
export type CreatorWithdrawal = typeof creatorWithdrawals.$inferSelect
